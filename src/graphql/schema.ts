import { buildSchema } from "graphql";
export const ApiSchema = buildSchema(`
type rootQuery{
    getHello:String
}
type User{
    name:String
    phone:String
    email:String
    username:String
    token:String
}
input SignUpInput{
    name:String!
    password:String!
    phone:String!
    email:String!
    username:String!
}

type rootMutation{
    newUser(user:SignUpInput!):User
    newPost(post:PostInput!):Post
    signIn(EmailOrPhone:String!, password:String!):User!
    isTokenValid(token:String!):Boolean!
    logout(all:Boolean!,token:String!):Boolean!
}
input PostInput{
    media:[String]
    caption:String
}
type Post{
    id: String
    type: String
    media: [String]
    caption: String
}
schema{
    query:rootQuery
    mutation:rootMutation
}

`);
