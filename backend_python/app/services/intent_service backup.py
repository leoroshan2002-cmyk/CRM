import re
from enum import Enum


class Intent(str, Enum):

    # =========================================================
    # EMPLOYEE
    # =========================================================

    GET_EMPLOYEES = "get_employees"

    GET_EMPLOYEE_DETAILS = "get_employee_details"

    GET_EMPLOYEE_FIELD = "get_employee_field"

    GET_EMPLOYEE_FIELD_LIST = "get_employee_field_list"

    GET_MY_DETAILS = "get_my_details"

    
    # =========================================================
    # ATTENDANCE
    # =========================================================

    GET_ATTENDANCE = "get_attendance"

    GET_ATTENDANCE_FIELD = "get_attendance_field"

    GET_ACTIVE_ATTENDANCE = "get_active_attendance"

    GET_ATTENDANCE_HISTORY = "get_attendance_history"


    # =========================================================
    # TASKS
    # =========================================================

    GET_TASKS = "get_tasks"

    GET_TASKS_BY_EMPLOYEE = "get_tasks_by_employee"

    GET_TASK = "get_task"

    CREATE_TASK = "create_task"

    UPDATE_TASK = "update_task"

    DELETE_TASK = "delete_task"
    # =========================================================
    # LEAVES
    # =========================================================

    GET_LEAVES = "get_leaves"

    GET_LEAVES_BY_EMPLOYEE = "get_leaves_by_employee"

    GET_APPROVED_LEAVES = "get_approved_leaves"

    GET_PENDING_LEAVES = "get_pending_leaves"

    GET_REJECTED_LEAVES = "get_rejected_leaves"

    CREATE_LEAVE = "create_leave"

    UPDATE_LEAVE = "update_leave"

    UPDATE_LEAVE_STATUS = "update_leave_status"


    # =========================================================
    # PAYROLL / PAYSLIP
    # =========================================================

    GET_PAYROLL = "get_payroll"

    GET_PAYROLL_BY_EMPLOYEE = "get_payroll_by_employee"

    GET_PAYROLL_DETAILS = "get_payroll_details"

    GET_PAYROLL_STATUS = "get_payroll_status"

    GET_PAID_PAYROLL = "get_paid_payroll"

    GET_PENDING_PAYROLL = "get_pending_payroll"

    GET_PAYSLIP_BY_EMPLOYEE_AND_MONTH = (
        "get_payslip_by_employee_and_month"
    )

    GET_PROJECTS = "get_projects"
    GET_PROJECT_PROGRESS = "get_project_progress"
    GET_PROJECT_DEADLINES = "get_project_deadlines"
    GET_PROJECT_TEAM = "get_project_team"
    GET_PROJECT_MILESTONES = "get_project_milestones"
    GET_PROJECT_NOTES = "get_project_notes"
    CREATE_PROJECT_NOTE = "create_project_note"
    UPDATE_PROJECT_NOTE = "update_project_note"
    DELETE_PROJECT_NOTE = "delete_project_note"
    GET_FOLLOWUPS = "get_followups"
    GET_MEETINGS = "get_meetings"
    # =========================================================
    # OTHER
    # =========================================================

    UNWANTED_TALK = "unwanted_talk"

    HUMAN_HELP = "human_help"

    GENERAL_CHAT = "general_chat"


# =========================================================
# COMMON HELPERS
# =========================================================

def _contains_any(
    text: str,
    words: list[str],
) -> bool:

    return any(
        word in text
        for word in words
    )


def _normalize(
    text: str,
) -> str:

    return re.sub(
        r"\s+",
        " ",
        text.strip().lower(),
    )


# =========================================================
# UNWANTED TALK
# =========================================================

UNWANTED_PATTERNS = [

    r"\btell me a joke\b",
    r"\bmake me laugh\b",
    r"\bdo you know any jokes\b",
    r"\bsay a joke\b",

    r"\bsing a song\b",
    r"\bsing for me\b",
    r"\bsing something\b",

    r"\btell me a story\b",
    r"\btell me a funny story\b",

    r"\bplay a game\b",
    r"\bplay with me\b",

    r"\bwho is your boyfriend\b",
    r"\bwho is your girlfriend\b",
    r"\bdo you have a girlfriend\b",
    r"\bdo you have a boyfriend\b",

    r"\bwhat is your favorite movie\b",
    r"\bwhat is your favorite song\b",

    r"\bwrite me a poem\b",
    r"\bwrite a poem\b",
    r"\bwrite me a song\b",
    r"\bwrite a song\b",

    r"\bdance for me\b",
    r"\bcan you dance\b",
]


def is_unwanted_talk(
    message: str,
) -> bool:

    text = _normalize(message)

    return any(
        re.search(
            pattern,
            text,
            flags=re.IGNORECASE,
        )
        for pattern in UNWANTED_PATTERNS
    )


# =========================================================
# HUMAN HELP
# =========================================================

HUMAN_HELP_PATTERNS = [

    r"\btalk to hr\b",
    r"\bconnect me to hr\b",
    r"\bconnect me with hr\b",
    r"\bcontact hr\b",

    r"\bi want to talk to hr\b",
    r"\bi need hr\b",

    r"\btalk to a human\b",
    r"\btalk to a person\b",

    r"\bconnect me to a human\b",
    r"\bconnect me with a person\b",

    r"\bneed human help\b",
    r"\bneed human assistance\b",

    r"\bcontact human\b",
    r"\bconnect with human\b",
]


def is_human_help_request(
    message: str,
) -> bool:

    text = _normalize(message)

    return any(
        re.search(
            pattern,
            text,
            flags=re.IGNORECASE,
        )
        for pattern in HUMAN_HELP_PATTERNS
    )


# =========================================================
# EMPLOYEE HELPERS
# =========================================================

def extract_employee_name(
    message: str,
) -> str | None:

    text = message.strip()

    patterns = [

        r"(?:show|get|find|give|display)\s+(.+?)\s+"
        r"(?:details|information|info)$",

        r"(?:show|get|find|give|display)\s+(.+?)\s+"
        r"(?:email|mail|phone|contact|role|position|department|designation)$",

        r"(?:what is|what's)\s+(.+?)\s+"
        r"(?:email|mail|phone|contact|role|position|department)$",
    ]

    for pattern in patterns:

        match = re.search(
            pattern,
            text,
            flags=re.IGNORECASE,
        )

        if match:

            name = match.group(1).strip()

            if name:
                return name

    return None


def extract_employee_field(
    message: str,
) -> str | None:

    text = _normalize(message)

    field_patterns = {

        "email": [
            "email",
            "mail",
            "email address",
        ],

        "contact": [
            "contact",
            "phone",
            "phone number",
            "mobile",
            "mobile number",
        ],

        "role": [
            "role",
            "position",
            "job role",
        ],

        "department": [
            "department",
            "dept",
        ],

        "designation": [
            "designation",
        ],
    }

    for field, keywords in field_patterns.items():

        if _contains_any(text, keywords):
            return field

    return None


def extract_employee_list_field(
    message: str,
) -> str | None:

    text = _normalize(message)

    if _contains_any(
        text,
        [
            "all emails",
            "employee emails",
            "all employee emails",
            "email addresses",
        ],
    ):
        return "email"

    if _contains_any(
        text,
        [
            "all contacts",
            "employee contacts",
            "all phone numbers",
            "employee phone numbers",
        ],
    ):
        return "contact"

    if _contains_any(
        text,
        [
            "all roles",
            "employee roles",
            "all positions",
        ],
    ):
        return "role"

    if _contains_any(
        text,
        [
            "all departments",
            "employee departments",
        ],
    ):
        return "department"

    if _contains_any(
        text,
        [
            "all designations",
            "employee designations",
        ],
    ):
        return "designation"

    return None


# =========================================================
# ATTENDANCE HELPERS
# =========================================================

def extract_attendance_employee_name(
    message: str,
) -> str | None:

    text = message.strip()

    patterns = [

        r"(?:show|get|find|give|display)\s+(.+?)\s+"
        r"(?:attendance|login|logout|status|break|attendance id|"
        r"total work|work time)",

        r"(?:what is|what's)\s+(.+?)\s+"
        r"(?:login|logout|attendance|status|break|work time)",
    ]

    for pattern in patterns:

        match = re.search(
            pattern,
            text,
            flags=re.IGNORECASE,
        )

        if match:

            name = match.group(1).strip()

            if name:
                return name

    return None


def extract_attendance_field(
    message: str,
) -> str | None:

    text = _normalize(message)

    if _contains_any(
        text,
        [
            "attendance id",
            "attendance id number",
        ],
    ):
        return "attendance_id"

    if _contains_any(
        text,
        [
            "login time",
            "login",
            "check in",
            "check-in",
            "checkin",
        ],
    ):
        return "login_time"

    if _contains_any(
        text,
        [
            "logout time",
            "logout",
            "check out",
            "check-out",
            "checkout",
        ],
    ):
        return "logout_time"

    if _contains_any(
        text,
        [
            "break start",
            "break started",
            "break in",
        ],
    ):
        return "break_start"

    if _contains_any(
        text,
        [
            "break end",
            "break ended",
            "break out",
        ],
    ):
        return "break_end"

    if _contains_any(
        text,
        [
            "status",
            "attendance status",
        ],
    ):
        return "status"

    if _contains_any(
        text,
        [
            "total work time",
            "total working time",
            "work time",
            "working time",
            "hours worked",
        ],
    ):
        return "total_work_seconds"

    return None



def extract_task_status_update(
    message: str,
) -> tuple[str, str] | None:
    """Extract the task title and requested new status."""

    patterns = [
        r"^\s*(?:please\s+)?(?:mark|set|change|update)\s+"
        r"(.+?)\s+(?:as|to)\s+"
        r"(in\s+progress|pending|completed|complete|done|finished|new)"
        r"\s*[.!?]*$",
    ]

    status_map = {
        "pending": "Pending",
        "in progress": "In Progress",
        "completed": "Completed",
        "complete": "Completed",
        "done": "Completed",
        "finished": "Completed",
        "new": "New",
    }

    for pattern in patterns:
        match = re.search(
            pattern,
            message.strip(),
            flags=re.IGNORECASE,
        )

        if match:
            task_title = match.group(1).strip()

            # Remove optional "task" wording from the title.
            task_title = re.sub(
                r"^\s*task\s+|\s+task\s*$",
                "",
                task_title,
                flags=re.IGNORECASE,
            ).strip()

            requested_status = status_map[
                match.group(2).lower()
            ]

            if task_title:
                return task_title, requested_status

    return None


def extract_task_employee_name(message: str) -> str | None:
    text = message.strip()

    patterns = [
        r"(?:show|get|find|give|display|list)\s+(.+?)\s+"
        r"(?:tasks|task|recent tasks|recent task)$",
        r"(?:tasks|task)\s+(?:for|of|assigned to)\s+(.+?)$",
    ]

    for pattern in patterns:
        match = re.search(
            pattern,
            text,
            flags=re.IGNORECASE,
        )

        if match:
            name = match.group(1).strip()

            if name and name.lower() not in {
                "my", "me", "mine", "all", "pending",
                "completed", "current", "previous", "recent",
            }:
                return name

    return None



def extract_task_id(message: str) -> str | None:
    match = re.search(
        r"(?:task\s*(?:id)?|task)\s*[:#]?\s*([a-zA-Z0-9_-]{4,})",
        message,
        flags=re.IGNORECASE,
    )

    if match:
        return match.group(1).strip()

    return None





# =========================================================
# LEAVE HELPERS
# =========================================================

def extract_leave_employee_name(
    message: str,
) -> str | None:

    text = message.strip()

    patterns = [

        r"(?:show|get|find|give|display)\s+(.+?)\s+"
        r"(?:leave|leaves|leave history)",

        r"(?:leave|leaves)\s+(?:for|of)\s+(.+?)(?:\?|$)",
    ]

    for pattern in patterns:

        match = re.search(
            pattern,
            text,
            flags=re.IGNORECASE,
        )

        if match:

            name = match.group(1).strip()

            if name:
                return name

    return None


def extract_leave_id(
    message: str,
) -> str | None:

    match = re.search(
        r"(?:leave\s*(?:id)?|leave request\s*(?:id)?)"
        r"\s*[:#]?\s*([a-zA-Z0-9_-]{4,})",
        message,
        flags=re.IGNORECASE,
    )

    if match:
        return match.group(1).strip()

    return None


def extract_leave_status(
    message: str,
) -> str | None:

    text = _normalize(message)

    statuses = [
        "approved",
        "rejected",
        "pending",
        "cancelled",
        "canceled",
    ]

    for status in statuses:

        if re.search(
            rf"\b{re.escape(status)}\b",
            text,
        ):

            if status == "canceled":
                return "cancelled"

            return status

    return None


# =========================================================
# PAYROLL HELPERS
# =========================================================

def extract_payroll_employee_name(
    message: str,
) -> str | None:

    text = message.strip()

    patterns = [

        r"(?:payslip|payroll|salary)\s+(?:for|of)\s+(.+?)(?:\?|$)",

        r"(?:show|get|find|give|display)\s+(.+?)\s+"
        r"(?:payslip|payroll|salary)$",

        r"(.+?)\s+(?:salary|payslip|payroll)\s+"
        r"(?:details|information|info)$",
    ]

    for pattern in patterns:

        match = re.search(
            pattern,
            text,
            flags=re.IGNORECASE,
        )

        if match:

            name = match.group(1).strip()

            invalid_names = [
                "all",
                "employees",
                "all employees",
                "my",
                "current",
                "latest",
                "pending",
                "paid",
            ]

            if (
                name
                and name.lower() not in invalid_names
            ):
                return name

    return None


def extract_payroll_status(
    message: str,
) -> str | None:

    text = _normalize(message)

    if re.search(r"\bpaid\b", text):
        return "Paid"

    if re.search(r"\bpending\b", text):
        return "Pending"

    return None


def extract_payroll_field(
    message: str,
) -> str | None:

    text = _normalize(message)

    field_patterns = {

        "basicSalary": [
            "basic salary",
            "basic",
        ],

        "medical": [
            "medical",
            "medical allowance",
        ],

        "performanceBonus": [
            "performance bonus",
            "bonus",
        ],

        "conveyance": [
            "conveyance",
            "travel allowance",
        ],

        "pf": [
            "pf",
            "provident fund",
        ],

        "esi": [
            "esi",
        ],

        "tds": [
            "tds",
        ],

        "professionalTax": [
            "professional tax",
        ],

        "gross": [
            "gross salary",
            "gross",
        ],

        "totalDeductions": [
            "total deductions",
            "deductions",
        ],

        "net": [
            "net salary",
            "net pay",
            "take home",
            "take-home",
        ],
    }

    for field, keywords in field_patterns.items():

        if _contains_any(
            text,
            keywords,
        ):
            return field

    return None


# =========================================================
# PAYSLIP MONTH HELPER
# =========================================================

def extract_payslip_month(
    message: str,
) -> str | None:

    text = _normalize(message)

    months = {
        "january": "January",
        "february": "February",
        "march": "March",
        "april": "April",
        "may": "May",
        "june": "June",
        "july": "July",
        "august": "August",
        "september": "September",
        "october": "October",
        "november": "November",
        "december": "December",
    }

    for month_key, month_value in months.items():

        if re.search(
            rf"\b{month_key}\b",
            text,
            flags=re.IGNORECASE,
        ):
            return month_value

    return None


# =========================================================
# PROJECT NOTE HELPERS
# =========================================================

def extract_project_note_request(
    message: str,
) -> dict | None:
    """
    Extract project-note commands.

    Add:
    Add note to Arushuvai Website: Homepage design completed

    Add with separate title and description:
    Add note to Arushuvai Website: Title: Product Page Design | Note: Homepage design reviewed

    View:
    Show my notes for Arushuvai Website

    Update:
    Update note 1 for Arushuvai Website: Homepage design reviewed
    """

    text = message.strip()

    # -----------------------------------------------------
    # ADD A NOTE
    # -----------------------------------------------------

    match = re.search(
        r"^\s*(?:please\s+)?(?:add|create|write)\s+"
        r"(?:a\s+)?note\s+(?:to|for)\s+"
        r"(.+?)\s*:\s*(.+?)\s*$",
        text,
        flags=re.IGNORECASE,
    )

    if match:
        project_title = match.group(1).strip()
        note_text = match.group(2).strip().rstrip(".!?")

        note_title = ""
        note_description = note_text

        # Support: Title: ... | Note: ...
        structured_match = re.fullmatch(
            r"title\s*:\s*(.+?)\s*\|\s*"
            r"note\s*:\s*(.+?)\s*",
            note_text,
            flags=re.IGNORECASE,
        )

        if structured_match:
            note_title = structured_match.group(1).strip()
            note_description = structured_match.group(2).strip()

        # Also support: Title: ... | Description: ...
        if not structured_match:
            structured_match = re.fullmatch(
                r"title\s*:\s*(.+?)\s*\|\s*"
                r"description\s*:\s*(.+?)\s*",
                note_text,
                flags=re.IGNORECASE,
            )

            if structured_match:
                note_title = structured_match.group(1).strip()
                note_description = structured_match.group(2).strip()

        if project_title and note_description:
          return {
                "action": "create",
                "project_title": project_title,
                "note_number": None,
                "note_title": note_title,
                "note_text": note_description,
            }
   
    # -----------------------------------------------------
    # DELETE A NUMBERED NOTE
    # -----------------------------------------------------

    match = re.search(
        r"^\s*(?:please\s+)?(?:delete|remove)\s+"
        r"note\s+#?(\d+)\s+(?:for|in|on)\s+"
        r"(.+?)\s*$",
        text,
        flags=re.IGNORECASE,
    )

    if match:
        note_number = int(match.group(1))
        project_title = match.group(2).strip().rstrip(".!?")

        if project_title and note_number > 0:
            return {
                "action": "delete",
                "project_title": project_title,
                "note_number": note_number,
                "note_title": None,
                "note_text": None,
            }

    # -----------------------------------------------------
    # UPDATE A NUMBERED NOTE
    # -----------------------------------------------------

    match = re.search(
        r"^\s*(?:please\s+)?(?:update|edit|change|modify)\s+"
        r"note\s+#?(\d+)\s+(?:for|in|on)\s+"
        r"(.+?)\s*:\s*(.+?)\s*$",
        text,
        flags=re.IGNORECASE,
    )

    if match:
        note_number = int(match.group(1))
        project_title = match.group(2).strip()
        note_text = match.group(3).strip().rstrip(".!?")

        if project_title and note_text:
            return {
                "action": "update",
                "project_title": project_title,
                "note_number": note_number,
                "note_title": None,
                "note_text": note_text,
            }

    # -----------------------------------------------------
    # VIEW NOTES FOR A PROJECT
    # -----------------------------------------------------

    match = re.search(
        r"^\s*(?:please\s+)?(?:show|view|list|get|display|see|check)\s+"
        r"(?:my\s+)?(?:previous\s+)?notes?\s+"
        r"(?:for|of|in|on)\s+(.+?)\s*$",
        text,
        flags=re.IGNORECASE,
    )

    if match:
        project_title = match.group(1).strip().rstrip(".!?")

        if project_title:
            return {
                "action": "view",
                "project_title": project_title,
                "note_number": None,
                "note_title": None,
                "note_text": None,
            }

    return None


# =========================================================
# DETECT INTENT
# =========================================================

def detect_intent(
    message: str,
) -> Intent:

    text = _normalize(message)

    # =====================================================
    # UNWANTED TALK
    # =====================================================

    if is_unwanted_talk(text):
        return Intent.UNWANTED_TALK

    # =====================================================
    # HUMAN HELP
    # =====================================================

    if is_human_help_request(text):
        return Intent.HUMAN_HELP
    
   
    # =====================================================
    # TASKS — CHECK BEFORE ATTENDANCE
    # =====================================================

    # -----------------------------------------------------
    # DELETE TASK
    # Examples:
    # Delete task Animation Website
    # Remove my task
    # -----------------------------------------------------

    if re.search(
        r"\b(delete|remove)\b.*\b(task|tasks|work|works)\b",
        text,
    ):
        return Intent.DELETE_TASK

    # -----------------------------------------------------
    # CREATE TASK
    # Examples:
    # Create a task
    # Add new task
    # -----------------------------------------------------

    if re.search(
        r"\b(create|add|new)\b.*\btask\b",
        text,
    ):
        return Intent.CREATE_TASK

    # -----------------------------------------------------
    # UPDATE TASK STATUS
    # Examples:
    # Mark Animation Website as Completed
    # Update Automation task to In Progress
    # -----------------------------------------------------

    if extract_task_status_update(text):
        return Intent.UPDATE_TASK

    if re.search(
        r"\b(mark|complete|finish|update|edit|change|modify)\b.*\btask\b",
        text,
    ):
        return Intent.UPDATE_TASK

   
    # -----------------------------------------------------
    # EMPLOYEE'S OWN TASK QUESTIONS
    # -----------------------------------------------------

    # Status questions about a named task, even if the word
    # "task" is not present.
    if (
        re.search(
            r"\b(is|are|was|were|have i|did i|have we|has)\b",
            text,
        )
        and re.search(
            r"\b(completed|complete|finished|done|"
            r"in progress|pending|overdue)\b",
            text,
        )
        and not re.search(
        r"\b(project|projects|website|milestone|deadline)\b",
        text,
        )
    ):
        return Intent.GET_TASKS

    # Questions asking for the status of a named task.
    if (
        re.search(
            r"\b(status|progress)\b",
            text,
        )
        and re.search(
            r"\b(task|tasks|assignment|assignments)\b",
            text,
        )
    ):
        return Intent.GET_TASKS

    # General task listing and status questions.
    if (
        re.search(
            r"\b(task|tasks|assignment|assignments)\b",
            text,
        )
        and re.search(
            r"\b(which|what|am i|i am|my|me|mine|"
            r"working on|working|currently|doing|assigned|"
            r"pending|completed|complete|finished|done|"
            r"in progress|incomplete|unfinished|"
            r"not completed|not finished|"
            r"current|previous|past|historical|all|recent|"
            r"show|list|get|display|give|check|status|progress|"
            r"overdue|today|tomorrow)\b",
            text,
        )
    ):
        return Intent.GET_TASKS

    # -----------------------------------------------------
    # TASKS FOR A SPECIFIC EMPLOYEE
    # -----------------------------------------------------

    task_employee = extract_task_employee_name(text)

    if (
        task_employee
        and re.search(r"\b(tasks?|recent tasks?)\b", text)
    ):
        return Intent.GET_TASKS_BY_EMPLOYEE


    # =====================================================
    # ATTENDANCE
    # =====================================================

    if _contains_any(
        text,
        [
            "active attendance",
            "currently working",
            "currently active",
            "who is working",
            "who are working",
        ],
    ):
        return Intent.GET_ACTIVE_ATTENDANCE

    if _contains_any(
        text,
        [
            "attendance history",
            "attendance records",
            "all attendance",
            "attendance report",
        ],
    ):
        return Intent.GET_ATTENDANCE_HISTORY
    attendance_field = extract_attendance_field(text)

    attendance_employee = None

    if not _contains_any(
        text,
        [
            "leave balance",
            "remaining leaves",
            "remaining leave",
            "available leaves",
            "available leave",
            "my leave",
            "my leaves",
            "leave request",
            "leave status",
            "status of my leave",
        ],
    ):
        attendance_employee = extract_attendance_employee_name(text)
    if (
        attendance_field
        and attendance_employee
    ):
        return Intent.GET_ATTENDANCE_FIELD

    if _contains_any(
        text,
        [
            "attendance",
            "attendance details",
            "attendance record",
        ],
    ):

        if attendance_employee:
            return Intent.GET_ATTENDANCE

        # WhatsApp employee asking about their own attendance
        if _contains_any(
            text,
            [
                "my attendance",
                "my attendance details",
                "my attendance record",
                "show my attendance",
                "show my attendance details",
                "what is my attendance",
                "what's my attendance",
            ],
        ):
            return Intent.GET_ATTENDANCE
        
        
    if re.search(r"\bfollow[\s-]*ups?\b", text):
        return Intent.GET_FOLLOWUPS
   
    # =====================================================
    # MY PROJECTS — NATURAL LANGUAGE
    # =====================================================

    # Project milestones
    if re.search(r"\b(milestone|milestones)\b", text):
        if _contains_any(text, [
            "my", "mine", "project", "projects",
            "assigned to me", "for me",
            "what", "show", "list", "get", "tell",
            "check", "view", "about",
        ]):
            return Intent.GET_PROJECT_MILESTONES

    # Project deadlines
    if re.search(r"\b(deadline|deadlines|due date|due dates)\b", text):
        if _contains_any(text, [
            "my", "mine", "project", "projects",
            "assigned to me", "for me",
            "what", "show", "list", "get", "tell",
            "check", "view", "about",
        ]):
            return Intent.GET_PROJECT_DEADLINES

    # Project team
    if _contains_any(text, [
        "project team", "project members",
        "team members", "my team", "who is working",
        "who are working", "who is assigned",
    ]):
        return Intent.GET_PROJECT_TEAM

    # Project progress
    if re.search(r"\b(progress|completion)\b", text):
        if _contains_any(text, [
            "my", "mine", "project", "projects",
            "assigned to me", "for me",
            "what", "show", "list", "get", "tell",
            "check", "view", "about", "how much",
        ]):
            return Intent.GET_PROJECT_PROGRESS

    # General project listing and status questions
    if re.search(r"\b(project|projects)\b", text):
        if _contains_any(text, [
            "my", "me", "mine", "assigned",
            "show", "list", "display", "get", "find",
            "search", "what", "which", "status",
            "details", "detail", "information",
            "info", "overview", "all", "current",
            "working", "working on", "completed",
            "complete", "finished", "pending",
            "active", "ongoing", "in progress",
            "at risk", "risk",
        ]):
            return Intent.GET_PROJECTS

    # Specific project status questions without the word project
    if (
        re.search(
            r"\b(is|are|was|were|has|have)\b",
            text,
        )
        and re.search(
            r"\b(completed|complete|finished|pending|"
            r"active|ongoing|in progress|at risk)\b",
            text,
        )
        and not re.search(
            r"\b(task|tasks|attendance|leave|payroll|salary)\b",
            text,
        )
    ):
        return Intent.GET_PROJECTS

    # Natural-language project detail questions
    if (
        _contains_any(text, [
            "my", "mine", "assigned to me", "for me",
        ])
        and _contains_any(text, [
            "details", "detail", "information",
            "info", "overview", "status",
        ])
        and _contains_any(text, [
            "show", "get", "find", "display",
            "list", "tell", "give", "check",
            "what", "about", "view",
        ])
    ):
        return Intent.GET_PROJECTS
 
   
    # =====================================================
    # PROJECT NOTES
    # Check before general project queries.
    # =====================================================

    # Update an existing numbered note.
    if re.search(
        r"\b(update|edit|change|modify)\s+note\s+#?\d+\b",
        text,
    ):
        return Intent.UPDATE_PROJECT_NOTE

    # Add a new project note.
    if re.search(
        r"\b(add|create|write)\s+note\b",
        text,
    ):
        return Intent.CREATE_PROJECT_NOTE

    # Delete an existing numbered project note.
    if re.search(
        r"\b(delete|remove)\s+note\s+#?\d+\b",
        text,
    ):
        return Intent.DELETE_PROJECT_NOTE

    # View notes for a project.
    if (
        re.search(r"\b(notes?|previous notes)\b", text)
        and re.search(
            r"\b(show|view|list|get|display|see|check)\b",
            text,
        )
    ):
        return Intent.GET_PROJECT_NOTES


       # =====================================================
    # MY FOLLOW-UPS
    # =====================================================

    if re.search(r"\bfollow[\s-]*ups?\b", text):
        return Intent.GET_FOLLOWUPS
 
    # MY MEETINGS
    if _contains_any(
        text,
      [
        "my meetings",
        "my meeting",
        "show my meetings",
        "show my meeting",
        "list my meetings",
        "list my meeting",
        "what are my meetings",
        "what is my meeting",
        "meetings assigned to me",
        "meeting assigned to me",
        "meetings for me",
        "meeting for me",
        "my upcoming meetings",
        "show my upcoming meetings",
        "my scheduled meetings",
        "show my scheduled meetings",
        "my meetings today",
        "show my meetings today",
      ],
    ):
     return Intent.GET_MEETINGS
    # =====================================================
    # LEAVES
    # =====================================================

     if _contains_any(
        text,
        [
            "leave balance",
            "leaves balance",
            "remaining leaves",
            "remaining leave",
            "available leaves",
            "available leave",
            "how many leaves do i have",
            "how much leave do i have",
        ],
    ):
        return Intent.GET_LEAVES_BY_EMPLOYEE

    # 2. Check the employee's own leave request status.
    # Keep this BEFORE create-leave detection.

    if _contains_any(
        text,
        [
            "my leave request status",
            "my leave status",
            "status of my leave",
            "status of my leave request",
            "what is my leave request status",
            "what's my leave request status",
            "check my leave status",
            "check my leave request",
            "track my leave request",
            "where is my leave request",
            "what happened to my leave request",
        ],
    ):
        return Intent.GET_LEAVES_BY_EMPLOYEE

    # 3. Check status-specific leave queries.

    if _contains_any(
        text,
        [
            "my approved leaves",
            "my approved leave",
            "show my approved leaves",
            "show my approved leave",
        ],
    ):
        return Intent.GET_APPROVED_LEAVES

    if _contains_any(
        text,
        [
            "my pending leaves",
            "my pending leave",
            "show my pending leaves",
            "show my pending leave",
        ],
    ):
        return Intent.GET_PENDING_LEAVES

    if _contains_any(
        text,
        [
            "my rejected leaves",
            "my rejected leave",
            "show my rejected leaves",
            "show my rejected leave",
        ],
    ):
        return Intent.GET_REJECTED_LEAVES

    # 4. General approved, pending, and rejected queries.

    if _contains_any(
        text,
        [
            "approved leaves",
            "approved leave",
            "show approved leaves",
            "show approved leave",
            "list approved leaves",
        ],
    ):
        return Intent.GET_APPROVED_LEAVES

    if _contains_any(
        text,
        [
            "pending leaves",
            "pending leave",
            "show pending leaves",
            "show pending leave",
            "list pending leaves",
        ],
    ):
        return Intent.GET_PENDING_LEAVES

    if _contains_any(
        text,
        [
            "rejected leaves",
            "rejected leave",
            "show rejected leaves",
            "show rejected leave",
            "list rejected leaves",
        ],
    ):
        return Intent.GET_REJECTED_LEAVES

    # 5. Create a leave request only when the user is
    # actually asking to apply for or create one.

    if _contains_any(
        text,
        [
            "create leave",
            "create a leave",
            "apply leave",
            "apply for leave",
            "request leave",
            "request a leave",
            "new leave",
            "i need leave",
            "i need a leave",
            "i want leave",
            "i want to take leave",
            "i need to take leave",
            "i want to apply for leave",
        ],
    ):
        return Intent.CREATE_LEAVE

    # 6. Leave modifications.

    if _contains_any(
        text,
        [
            "update leave",
            "edit leave",
            "change leave",
            "modify leave",
        ],
    ):
        return Intent.UPDATE_LEAVE

    if _contains_any(
        text,
        [
            "approve leave",
            "reject leave",
            "cancel leave",
            "change leave status",
        ],
    ):
        return Intent.UPDATE_LEAVE_STATUS

    if (
        _contains_any(
            text,
            [
                "leave id",
                "leave request",
            ],
        )
        and extract_leave_id(text)
        and extract_leave_status(text)
    ):
        return Intent.UPDATE_LEAVE_STATUS

    # 7. The employee's own leave history.

    if _contains_any(
        text,
        [
            "my leaves",
            "my leave",
            "my leave details",
            "my leave history",
            "show my leaves",
            "show my leave",
            "show my leave history",
            "what are my leaves",
            "what is my leave",
            "what leaves have i taken",
            "have i taken any leave",
            "show my leave records",
            "list my leave records",
        ],
    ):
        return Intent.GET_LEAVES_BY_EMPLOYEE

    # 8. General leave records.

    if _contains_any(
        text,
        [
            "leave history",
            "leave records",
            "all leave records",
            "show leave records",
            "show all leaves",
            "all leaves",
            "all leave",
            "show leaves",
            "list leaves",
            "list leave records",
        ],
    ):
        leave_employee = extract_leave_employee_name(text)

        if leave_employee:
            return Intent.GET_LEAVES_BY_EMPLOYEE

        return Intent.GET_LEAVES

    # =====================================================
    # MY LEAVES
    # =====================================================

    if _contains_any(
        text,
        [
           "my leaves",
        "my leave",
        "my leave details",
        "my leave history",
        "show my leaves",
        "show my leave",
        "show my leave history",
        "what are my leaves",
        "what is my leave",
        "what leaves have i taken",
        "my pending leaves",
        "my pending leave",
        "show my pending leaves",
        "show my pending leave",
        "my approved leaves",
        "my approved leave",
        "show my approved leaves",
        "show my approved leave",
        "my rejected leaves",
        "my rejected leave",
        "show my rejected leaves",
        "show my rejected leave",
        "my leave balance",
        "show my leave balance",
        "what is my leave balance",
        ],
    ):
        return Intent.GET_LEAVES_BY_EMPLOYEE

    # =====================================================
    # GENERAL LEAVE LIST
    # =====================================================

    if _contains_any(
        text,
        [
            "leave history",
            "leave records",
            "all leave records",
            "show leave records",
            "show all leaves",
            "all leaves",
            "all leave",
            "show leaves",
            "list leaves",
            "list leave records",
        ],
    ):

        leave_employee = extract_leave_employee_name(text)

        if leave_employee:
            return Intent.GET_LEAVES_BY_EMPLOYEE

        return Intent.GET_LEAVES

    # =====================================================
    # PAYROLL / PAYSLIP
    # =====================================================

    payroll_employee = extract_payroll_employee_name(text)

    payroll_status = extract_payroll_status(text)

    payroll_field = extract_payroll_field(text)

    payslip_month = extract_payslip_month(text)

    # =====================================================
    # MY PAYSLIP / MY PAYROLL
    # =====================================================

    if _contains_any(
        text,
        [
         "my payroll",
         "my salary",
         "my salary details",
         "my payroll details",
         "show my payroll",
         "show my salary",
         "what is my salary",
         "what is my payroll",
         "my payslip",
         "my payslip details",
         "show my payslip",
         "show my payslip details",
         "get my payslip",
         "my latest payslip",
         "show my latest payslip",
         "my current payslip",
      
        ],
    ):
         if payslip_month:
            return Intent.GET_PAYSLIP_BY_EMPLOYEE_AND_MONTH

         return Intent.GET_PAYROLL
    # =====================================================
    # PAID PAYROLL
    # =====================================================

    if _contains_any(
        text,
        [
           "my paid payroll",
           "show my paid payroll",
           "show my paid payslips"
           "paid payroll",
           "paid payslips",
           "paid salaries",
           "show paid payroll",
           "show paid payslips",
        ],
    ):
        return Intent.GET_PAID_PAYROLL

    # =====================================================
    # PENDING PAYROLL
    # =====================================================

    if _contains_any(
        text,
        [
            "my pending payroll",
            "show my pending payroll",
            "show my pending payslips"
            "pending payroll",
            "pending payslips",
            "pending salaries",
            "show pending payroll",
            "show pending payslips",
        ],
    ):
        return Intent.GET_PENDING_PAYROLL

    # =====================================================
    # SPECIFIC SALARY FIELD
    # =====================================================

    if (
        payroll_field
        and payroll_employee
    ):
        return Intent.GET_PAYROLL_DETAILS

    # =====================================================
    # PAYSLIP FOR EMPLOYEE AND MONTH
    # =====================================================

    if (
        payroll_employee
        and payslip_month
        and _contains_any(
            text,
            [
                "payslip",
                "payroll",
                "salary",
            ],
        )
    ):
        return Intent.GET_PAYSLIP_BY_EMPLOYEE_AND_MONTH

   
    # =====================================================
    # PAYROLL BY EMPLOYEE
    # =====================================================

    if (
        payroll_employee
        and _contains_any(
            text,
            [
                "payroll",
                "payslip",
                "salary",
            ],
        )
    ):
        return Intent.GET_PAYROLL_BY_EMPLOYEE

    # =====================================================
    # PAYROLL STATUS
    # =====================================================

    if (
        payroll_status
        and _contains_any(
            text,
            [
                "payroll",
                "payslip",
                "salary",
            ],
        )
    ):
        return Intent.GET_PAYROLL_STATUS

    # =====================================================
    # ALL PAYROLL
    # =====================================================

    if _contains_any(
        text,
        [
            "all payroll",
            "show payroll",
            "show all payroll",
            "list payroll",
            "all payslips",
            "show payslips",
            "show all payslips",
            "list payslips",
            "payroll records",
            "payslip records",
        ],
    ):
        return Intent.GET_PAYROLL

    # =====================================================
    # EMPLOYEES
    # =====================================================

    if _contains_any(
        text,
        [
            "my attendance",
        "my attendance details",
        "my attendance history",
        "show my attendance",
        "show my attendance history",
        "what is my attendance",
        "what's my attendance",
        "what is my attendance today",
        "what is my attendance this month",
        "my attendance this month",
        "am i present",
        "am i present today",
        "was i present today",
        "was i absent today",
        ],
    ):
        return Intent.GET_EMPLOYEES

    employee_list_field = extract_employee_list_field(text)

    if employee_list_field:
        return Intent.GET_EMPLOYEE_FIELD_LIST

    # =====================================================
    # MY EMPLOYEE DETAILS
    # =====================================================

    if _contains_any(
        text,
        [
            "my details",
            "my employee details",
            "my profile",
            "my employee information",
            "show my details",
            "show my employee details",
            "show my profile",
            "what are my employee details",
            "i want to know my employee details",
        ],
    ):
        return Intent.GET_MY_DETAILS

    # =====================================================
    # EMPLOYEE FIELD
    # =====================================================

    employee_field = extract_employee_field(text)

    employee_name = extract_employee_name(text)

    if (
        employee_field
        and employee_name
    ):
        return Intent.GET_EMPLOYEE_FIELD

    # =====================================================
    # EMPLOYEE DETAILS
    # =====================================================

    if _contains_any(
        text,
        [
            "employee details",
            "employee information",
            "employee info",
        ],
    ):

        if employee_name:
            return Intent.GET_EMPLOYEE_DETAILS

    # =====================================================
    # GENERAL CHAT
    # =====================================================

    return Intent.GENERAL_CHAT