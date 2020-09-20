import { User } from "./interfaces";
import validator from "validator";

export function userValidator(user: User) {
  const errArr = [];
  for (let obj in user) {
    switch (obj) {
      case "name":
        user.name.length > 2 ? "" : errArr.push("Not A Valid Name");
        break;
      case "email":
        validator.isEmail(user.email) ? "" : errArr.push("Not A Valid Email");
        break;
      case "password":
        user.password.length > 7 ? "" : errArr.push("Not A Valid Password");
        break;
      case "username":
        user.username.length > 2 ? "" : errArr.push("Not A Valid Username");
        break;
      case "phone":
        let isPhone = validator.isMobilePhone(user.phone);
        isPhone ? "" : errArr.push("Not A Valid Phone Number");
        break;
      default:
        break;
    }
  }
  if (errArr.length > 0)
    throw new Error(errArr.reduce((acc, val) => acc + val + " "));
}
