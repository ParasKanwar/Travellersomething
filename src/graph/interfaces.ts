export interface User {
  name: string;
  tokens: string[];
  username: string;
  phone: string;
  email: string;
  EmailVerified?: boolean;
  PhoneVerified?: boolean;
  password: string;
}
export interface Post {
  id: string;
  type: string;
  media: string[];
  caption?: string;
}
export interface Host {
  // attributes about host like does he/she have aadharcard i.e verified home location etc
}
export interface Comment {
  commentId: string;
  text: string;
  date: string;
}
