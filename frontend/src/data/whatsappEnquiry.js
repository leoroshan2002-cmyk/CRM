const phoneNumber = "918525906562";
const enquiryMessage = "Hi, I would like to enquire about employee details.";

export const WHATSAPP_EMPLOYEE_ENQUIRY_URL =
  `https://wa.me/${phoneNumber}?text=${encodeURIComponent(enquiryMessage)}`;
