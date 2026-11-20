const Employee = require("../models/Employee");
const User = require("../models/User");

async function generatePermanentEmployeeId() {
  const [employees, users] = await Promise.all([
    Employee.find({ empId: /^EMP-\d+$/ }).select("empId").lean(),
    User.find({ "profile.empId": /^EMP-\d+$/ }).select("profile.empId").lean(),
  ]);

  let highest = 1000;
  for (const employee of employees) {
    const match = /^EMP-(\d+)$/.exec(employee.empId || "");
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  for (const user of users) {
    const match = /^EMP-(\d+)$/.exec(user.profile?.empId || "");
    if (match) highest = Math.max(highest, Number(match[1]));
  }

  let next = highest + 1;
  while (await Employee.exists({ empId: `EMP-${next}` }) ||
         await User.exists({ "profile.empId": `EMP-${next}` })) {
    next += 1;
  }
  return `EMP-${next}`;
}

module.exports = { generatePermanentEmployeeId };
