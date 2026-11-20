
import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

from app.core.config import get_settings
from app.services.ai_service import AiService, get_ai_service
from app.services.chat_service import (
    ChatService,
    find_employee_by_phone,
)
from app.services.crm_service import (
    CrmService,
    CrmServiceError,
    get_crm_service,
)
from app.services.handoff_service import (
    HumanHandoffService,
    get_handoff_service,
)
from app.services.whatsapp_service import (
    WhatsAppService,
    WhatsAppServiceError,
    get_whatsapp_service,
)
from app.services.automation_service import automation_service


logger = logging.getLogger("app.api.whatsapp")
router = APIRouter(prefix="/api/whatsapp", tags=["WhatsApp"])

# Temporary in-memory storage for leave request sessions.
leave_flow_sessions = {}

# Prevent duplicate processing of the same WhatsApp webhook message.
processed_message_ids = set()


def parse_leave_date(value: str):
    """Parse supported leave date formats."""
    for fmt in (
        "%Y-%m-%d",
        "%d-%m-%Y",
        "%d/%m/%Y",
        "%d %B %Y",
        "%d %b %Y",
    ):
        try:
            return datetime.strptime(value.strip(), fmt).date()
        except ValueError:
            continue
    return None


def is_leave_history_or_status_message(message: str) -> bool:
    """Identify leave-history/status queries before the leave wizard runs."""
    normalized = " ".join(message.lower().strip().split())

    phrases = [
        "show my leave history",
        "my leave history",
        "view my leave history",
        "check my leave history",
        "show leave history",
        "leave history",
        "show my leave records",
        "my leave records",
        "view my leave records",
        "check my leave records",
        "what is my leave request status",
        "what's my leave request status",
        "what is the status of my leave request",
        "status of my leave request",
        "status of my leave",
        "my leave request status",
        "my leave status",
        "check my leave status",
        "track my leave request",
        "where is my leave request",
        "what happened to my leave request",
    ]

    return any(phrase in normalized for phrase in phrases)


def is_task_message(message: str) -> bool:
    """Identify common task-related WhatsApp requests."""
    normalized = " ".join(message.lower().strip().split())

    task_phrases = [
        "my task",
        "my tasks",
        "tasks assigned to me",
        "task assigned to me",
        "assigned task",
        "assigned tasks",
        "pending task",
        "pending tasks",
        "completed task",
        "completed tasks",
        "task status",
        "status of my task",
        "status of my tasks",
        "task history",
        "task details",
        "update task",
        "update my task",
        "update my task work",
        "edit task",
        "change task",
        "complete task",
        "complete my task",
        "finish task",
        "mark my task",
        "mark task",
        "mark my task as completed",
        "create task",
        "create a task",
        "add task",
        "new task",
        "show tasks",
        "show task",
        "list my tasks",
        "what is my task",
        "what are my tasks",
        "what are my pending tasks",
        "what is my pending task",
        "delete task",
        "delete my task",
        "delete my tasks",
        "remove task",
        "remove my task",
        "delete my updated works",
    ]

    return any(phrase in normalized for phrase in task_phrases)

async def continue_leave_flow(crm, phone: str, message: str):
    """Collect leave details and submit the request."""
    session = leave_flow_sessions.get(phone)

    if not session:
        return None

    message = message.strip()

    if message.lower() in {"cancel", "cancel leave"}:
        leave_flow_sessions.pop(phone, None)
        return "Your leave request process has been cancelled."

    stage = session["stage"]

    if stage == "leave_type":
        session["leaveType"] = message
        session["stage"] = "leave_from"
        return (
            "What is your leave start date?\n"
            "Use YYYY-MM-DD format. Example: 2026-10-20"
        )

    if stage == "leave_from":
        start_date = parse_leave_date(message)

        if not start_date:
            return (
                "Please enter a valid start date using "
                "YYYY-MM-DD format. Example: 2026-10-20"
            )

        session["leaveFrom"] = start_date.isoformat()
        session["stage"] = "leave_to"

        return (
            "What is your leave end date?\n"
            "Use YYYY-MM-DD format. Example: 2026-10-21"
        )

    if stage == "leave_to":
        end_date = parse_leave_date(message)

        if not end_date:
            return (
                "Please enter a valid end date using "
                "YYYY-MM-DD format. Example: 2026-10-21"
            )

        start_date = datetime.strptime(
            session["leaveFrom"], "%Y-%m-%d"
        ).date()

        if end_date < start_date:
            return (
                "The end date cannot be before the start date. "
                "Please enter the end date again."
            )

        session["leaveTo"] = end_date.isoformat()
        session["stage"] = "leave_reason"

        return "Please tell me the reason for your leave."

    if stage == "leave_reason":
        session["leaveReason"] = message

        leave_data = {
            "leaveTitle": "Leave Request",
            "leaveReason": session["leaveReason"],
            "leaveFrom": session["leaveFrom"],
            "leaveTo": session["leaveTo"],
            "employeeName": session["employeeName"],
            "employeeId": session["employeeId"],
            "department": session["department"],
            "leaveType": session["leaveType"],
        }

        try:
            result = await crm.create_leave(leave_data)
        except CrmServiceError:
            logger.exception(
                "Failed to submit WhatsApp leave request"
            )
            return (
                "I couldn't submit your leave request right now. "
                "Please send your reason again to retry."
            )

        if not result.get("success"):
            return (
                "Your leave request could not be submitted. "
                f"{result.get('message', 'Please try again.')}"
            )

        leave = result.get("leave") or {}
        leave_flow_sessions.pop(phone, None)

        return (
            "Your leave request has been submitted successfully!\n\n"
            f"Employee: {session['employeeName']}\n"
            f"Leave type: {session['leaveType']}\n"
            f"From: {session['leaveFrom']}\n"
            f"To: {session['leaveTo']}\n"
            f"Status: {leave.get('status', 'Pending')}\n\n"
            "Your request is awaiting approval."
        )

    leave_flow_sessions.pop(phone, None)
    return "The leave request flow was reset. Please start again."


class WhatsAppSendRequest(BaseModel):
    phone_number: str
    message: str


def get_chat_service(
    ai: AiService = Depends(get_ai_service),
    crm: CrmService = Depends(get_crm_service),
    handoff: HumanHandoffService = Depends(get_handoff_service),
) -> ChatService:
    return ChatService(
        ai=ai,
        crm=crm,
        handoff=handoff,
    )


@router.post("/send")
async def send_whatsapp_message(
    data: WhatsAppSendRequest,
    crm: CrmService = Depends(get_crm_service),
    whatsapp_service: WhatsAppService = Depends(get_whatsapp_service),
):
    """Send a WhatsApp message through Meta Cloud API."""

    phone_number = str(data.phone_number).strip()
    message = str(data.message).strip()

    if not phone_number:
        return {
            "success": False,
            "message": "Phone number is required.",
        }

    if not message:
        return {
            "success": False,
            "message": "Message is required.",
        }

    try:
        employees = await crm.get_employees()
        employee = find_employee_by_phone(employees, phone_number)

        conversation = await find_or_create_conversation(
            crm=crm,
            phone=phone_number,
            employee=employee,
        )

        conversation_id = (
            conversation.get("_id") or conversation.get("id")
        )

        if not conversation_id:
            raise WhatsAppServiceError(
                "Conversation ID could not be determined.",
                status_code=500,
            )

        result = await whatsapp_service.send_message(
            phone_number=phone_number,
            message=message,
        )

        await crm.add_conversation_message(
            conversation_id=conversation_id,
            sender="agent",
            message=message,
        )

        logger.info(
            "CRM WhatsApp message sent conversation_id=%s to=%s",
            conversation_id,
            phone_number,
        )

        return {
            "success": True,
            "conversation_id": conversation_id,
            "message": message,
            "phone_number": phone_number,
            "meta_response": result,
        }

    except WhatsAppServiceError as exc:
        logger.exception(
            "Failed to send CRM WhatsApp message to=%s",
            phone_number,
        )
        return {"success": False, "message": str(exc)}

    except CrmServiceError as exc:
        logger.exception(
            "CRM error while sending WhatsApp message to=%s",
            phone_number,
        )
        return {"success": False, "message": str(exc)}

    except Exception as exc:
        logger.exception(
            "Unexpected error while sending CRM WhatsApp message"
        )
        return {"success": False, "message": str(exc)}


@router.get("/webhook")
async def verify_webhook(
    hub_mode: str | None = Query(default=None, alias="hub.mode"),
    hub_verify_token: str | None = Query(
        default=None, alias="hub.verify_token"
    ),
    hub_challenge: str | None = Query(
        default=None, alias="hub.challenge"
    ),
):
    settings = get_settings()

    if (
        hub_mode == "subscribe"
        and hub_verify_token == settings.WHATSAPP_VERIFY_TOKEN
    ):
        logger.info("WhatsApp webhook verified successfully")
        return PlainTextResponse(content=hub_challenge or "")

    logger.warning("WhatsApp webhook verification failed")
    return PlainTextResponse(
        content="Verification failed",
        status_code=403,
    )


async def find_or_create_conversation(
    crm: CrmService,
    phone: str,
    employee: dict | None,
) -> dict:
    conversations = await crm.get_conversations()

    normalized_phone = (
        str(phone)
        .replace("+", "")
        .replace(" ", "")
        .replace("-", "")
        .strip()
    )

    for conversation in conversations:
        conversation_phone = (
            str(conversation.get("phone", ""))
            .replace("+", "")
            .replace(" ", "")
            .replace("-", "")
            .strip()
        )

        status = conversation.get("status", "")

        if (
            conversation_phone == normalized_phone
            and status != "Completed"
        ):
            logger.info(
                "Existing conversation found phone=%s conversation_id=%s",
                phone,
                conversation.get("_id"),
            )
            return conversation

    employee_name = (
        employee.get("employeeName", "WhatsApp User")
        if employee
        else "WhatsApp User"
    )

    conversation_data = {
        "contactId": (
            employee.get("_id") if employee else normalized_phone
        ),
        "contactName": employee_name,
        "phone": phone,
        "email": "",
        "crmUserId": employee.get("_id", "") if employee else "",
        "department": employee.get("department", "") if employee else "",
        "status": "In Progress",
        "intent": "General Query",
        "channel": "WhatsApp",
        "handledBy": "AI",
    }

    conversation = await crm.create_conversation(conversation_data)

    logger.info(
        "New WhatsApp conversation created phone=%s conversation_id=%s",
        phone,
        conversation.get("_id"),
    )

    return conversation


@router.post("/webhook")
async def receive_webhook(
    request: Request,
    chat_service: ChatService = Depends(get_chat_service),
    crm: CrmService = Depends(get_crm_service),
    whatsapp_service: WhatsAppService = Depends(get_whatsapp_service),
):
    try:
        payload = await request.json()
    except Exception:
        logger.exception("Failed to parse WhatsApp webhook JSON")
        return {"status": "invalid_payload"}

    logger.info("WhatsApp webhook received")

    entries = payload.get("entry", [])

    if not entries:
        return {"status": "received"}

    for entry in entries:
        changes = entry.get("changes", [])

        for change in changes:
            value = change.get("value", {})

            statuses = value.get("statuses", [])

            if statuses:
                logger.info(
                    "WhatsApp status event received count=%d",
                    len(statuses),
                )

            messages = value.get("messages", [])

            if not messages:
                continue

            for message in messages:
                sender_phone = message.get("from")
                message_id = message.get("id")
                message_type = message.get("type")
                timestamp = message.get("timestamp")

                if message_id:
                    if message_id in processed_message_ids:
                        logger.warning(
                            "Duplicate WhatsApp message ignored message_id=%s",
                            message_id,
                        )
                        continue

                    processed_message_ids.add(message_id)

                logger.info(
                    "WhatsApp incoming message from=%s message_id=%s "
                    "type=%s timestamp=%s",
                    sender_phone,
                    message_id,
                    message_type,
                    timestamp,
                )

                if not sender_phone:
                    logger.warning(
                        "WhatsApp message has no sender phone"
                    )
                    continue

                if message_type != "text":
                    logger.info(
                        "Ignoring unsupported WhatsApp message type=%s",
                        message_type,
                    )
                    continue

                text_data = message.get("text", {})
                message_text = text_data.get("body", "").strip()

                logger.info(
                    "WhatsApp incoming message TEXT=%r",
                    message_text,
                )

                if not message_text:
                    logger.warning("WhatsApp message text is empty")
                    continue

                request_id = message_id or str(uuid.uuid4())

                try:
                    employees = await crm.get_employees()

                    employee = find_employee_by_phone(
                        employees,
                        sender_phone,
                    )

                    if employee:
                        logger.info(
                            "WhatsApp employee identified employee=%s",
                            employee.get("employeeName"),
                        )
                    else:
                        logger.warning(
                            "No CRM employee found phone=%s",
                            sender_phone,
                        )

                    conversation = await find_or_create_conversation(
                        crm=crm,
                        phone=sender_phone,
                        employee=employee,
                    )

                    conversation_id = (
                        conversation.get("_id")
                        or conversation.get("id")
                    )

                    if not conversation_id:
                        logger.error(
                            "Conversation has no ID phone=%s",
                            sender_phone,
                        )
                        continue

                    await crm.add_conversation_message(
                        conversation_id=conversation_id,
                        sender="customer",
                        message=message_text,
                    )

                    logger.info(
                        "Customer message saved conversation_id=%s",
                        conversation_id,
                    )
                    if is_task_message(message_text):
                        logger.info(
                            "Task request detected; routing to ChatService "
                            "conversation_id=%s",
                            conversation_id,
                        )

                        answer = await chat_service.process_message(
                            message=message_text,
                            source="whatsapp",
                            conversation_id=conversation_id,
                            request_id=request_id,
                            employee_name=(
                                employee.get("employeeName")
                                if employee
                                else "WhatsApp User"
                            ),
                            employee_phone=sender_phone,
                        )

                    # ==========================================
                    # PRIORITY 2: LEAVE HISTORY / STATUS QUERIES
                    # ==========================================
                    # Route these directly to ChatService before
                    # checking whether a leave application is active.
                    if is_leave_history_or_status_message(message_text):
                        logger.info(
                            "Leave history/status query detected; "
                            "bypassing leave wizard message=%r",
                            message_text,
                        )

                        answer = await chat_service.process_message(
                            message=message_text,
                            source="whatsapp",
                            conversation_id=conversation_id,
                            request_id=request_id,
                            employee_name=(
                                employee.get("employeeName")
                                if employee
                                else "WhatsApp User"
                            ),
                            employee_phone=sender_phone,
                        )

                    else:
                        # ==========================================
                        # PRIORITY 2: CONTINUE ACTIVE LEAVE REQUEST
                        # ==========================================
                        answer = await continue_leave_flow(
                            crm=crm,
                            phone=sender_phone,
                            message=message_text,
                        )

                        # ==========================================
                        # PRIORITY 3: AUTOMATION RULES / NORMAL CHAT
                        # ==========================================
                        if answer is None:
                            active_rules = (
                                await crm.get_active_automation_rules()
                            )

                            normalized_message = " ".join(
                                message_text.lower().strip().split()
                            )

                            balance_phrases = [
                                "leave balance",
                                "balance of my leave",
                                "how many leaves do i have",
                                "how many leave do i have",
                                "remaining leaves",
                                "remaining leave",
                                "leave remaining",
                            ]

                            if any(
                                phrase in normalized_message
                                for phrase in balance_phrases
                            ):
                                matching_rule = next(
                                    (
                                        rule
                                        for rule in active_rules
                                        if str(
                                            rule.get("action", "")
                                        ).strip().lower()
                                        == "fetch leave balance"
                                    ),
                                    None,
                                )
                            else:
                                matching_rule = (
                                    automation_service.find_matching_rule(
                                        message=message_text,
                                        rules=active_rules,
                                    )
                                )

                            if matching_rule:
                                logger.info(
                                    "Automation rule matched rule=%s "
                                    "action=%s conversation_id=%s",
                                    matching_rule.get("name"),
                                    matching_rule.get("action"),
                                    conversation_id,
                                )

                                action = str(
                                    matching_rule.get("action", "")
                                ).strip().lower()

                                if action == "start leave flow":
                                    employee_id = (
                                        (
                                            employee.get("_id")
                                            or employee.get("id")
                                        )
                                        if employee
                                        else None
                                    )

                                    employee_name = (
                                        employee.get("employeeName")
                                        if employee
                                        else None
                                    )

                                    department = (
                                        employee.get("department")
                                        if employee
                                        else None
                                    )

                                    if not employee_id:
                                        answer = (
                                            "I couldn't identify your "
                                            "employee record. Please contact "
                                            "HR to submit a leave request."
                                        )

                                    elif (
                                        not employee_name
                                        or not department
                                    ):
                                        answer = (
                                            "Some required employee details "
                                            "are missing from your CRM "
                                            "employee record. Please contact "
                                            "HR for help."
                                        )

                                    else:
                                        leave_flow_sessions[sender_phone] = {
                                            "stage": "leave_type",
                                            "employeeId": str(employee_id),
                                            "employeeName": employee_name,
                                            "department": department,
                                        }

                                        answer = (
                                            "I'll help you submit a leave "
                                            "request.\n\n"
                                            "What type of leave do you need?\n"
                                            "For example: Sick Leave, Casual "
                                            "Leave, or Annual Leave.\n\n"
                                            "Reply CANCEL at any time to stop."
                                        )

                                else:
                                    answer = (
                                        await chat_service.execute_automation_rule(
                                            rule=matching_rule,
                                            message=message_text,
                                            source="whatsapp",
                                            conversation_id=conversation_id,
                                            request_id=request_id,
                                            employee_name=(
                                                employee.get("employeeName")
                                                if employee
                                                else "WhatsApp User"
                                            ),
                                            employee_phone=sender_phone,
                                        )
                                    )

                                    if not answer:
                                        answer = (
                                            await chat_service.process_message(
                                                message=message_text,
                                                source="whatsapp",
                                                conversation_id=conversation_id,
                                                request_id=request_id,
                                                employee_name=(
                                                    employee.get("employeeName")
                                                    if employee
                                                    else "WhatsApp User"
                                                ),
                                                employee_phone=sender_phone,
                                            )
                                        )

                            else:
                                logger.info(
                                    "No active automation rule matched; "
                                    "using normal chat processing "
                                    "conversation_id=%s",
                                    conversation_id,
                                )

                                answer = await chat_service.process_message(
                                    message=message_text,
                                    source="whatsapp",
                                    conversation_id=conversation_id,
                                    request_id=request_id,
                                    employee_name=(
                                        employee.get("employeeName")
                                        if employee
                                        else "WhatsApp User"
                                    ),
                                    employee_phone=sender_phone,
                                )

                    logger.info(
                        "WhatsApp message processed conversation_id=%s",
                        conversation_id,
                    )

                    await crm.add_conversation_message(
                        conversation_id=conversation_id,
                        sender="ai",
                        message=answer,
                    )

                    logger.info(
                        "AI response saved conversation_id=%s",
                        conversation_id,
                    )

                    try:
                        await whatsapp_service.send_message(
                            phone_number=sender_phone,
                            message=answer,
                        )

                        logger.info(
                            "WhatsApp response sent successfully to=%s",
                            sender_phone,
                        )

                    except WhatsAppServiceError:
                        logger.exception(
                            "Failed to send WhatsApp response to=%s",
                            sender_phone,
                        )

                except CrmServiceError:
                    logger.exception(
                        "CRM error while processing WhatsApp message "
                        "from=%s",
                        sender_phone,
                    )

                except Exception:
                    logger.exception(
                        "Failed to process WhatsApp message from=%s",
                        sender_phone,
                    )

    return {"status": "received"}
