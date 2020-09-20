import { User } from "../graph/interfaces";
import {
  createUser,
  isUserAuthorized,
  loginUser,
  userLogout,
} from "../graph/queries";
export const ApiResolver = {
  getHello() {
    return "Hello";
  },
  async newUser({ user }: { user: User }) {
    return await createUser({
      payload: { ...user, PhoneVerified: false, EmailVerified: false },
    });
  },
  async signIn(a: any) {
    return await loginUser(a.EmailOrPhone, a.password);
  },
  async isTokenValid({ token }: { token: string }) {
    return await isUserAuthorized({ token });
  },
  async logout({ all, token }: { all: boolean; token: string }) {
    try {
      return await userLogout({ all, token });
    } catch (e) {
      return false;
    }
  },
};
