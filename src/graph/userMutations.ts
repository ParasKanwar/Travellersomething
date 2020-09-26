import { auth, driver, QueryResult } from "neo4j-driver";
import { compare, hash } from "bcryptjs";
import { UserModel } from "./dbmodelnames";
import { User } from "./interfaces";
import { userValidator } from "./validators";
import { sign, verify } from "jsonwebtoken";
import validator from "validator";
import { createClient } from "redis";
const redisClient = createClient({ host: "redis" });
const neo4jDriver = driver(
  !process.env.isProd ? "bolt://localhost:7687" : "neo4j://graphdb:7687",
  auth.basic("neo4j", "ILoveOpenSource")
);

export async function initializeDatabaseConstraints() {
  const session = neo4jDriver.session();
  session
    .run("call db.constraints()")
    .then((val) => console.log(val))
    .catch((e) => {
      console.log(e.message);
    });
}

export async function createUser({ payload }: { payload: User }) {
  try {
    userValidator(payload);
    const res = await promisifyGraphQuery(
      `create (user:${UserModel} {name : $name, username : $username,phone : $phone,email : $email,PhoneVerified : $PhoneVerified,EmailVerified:$EmailVerified, password : $password}) return user`,
      { ...payload, password: await hash(payload.password, 8) }
    );
    const resObj: any = res.records[0].toObject();
    const token = sign(
      { id: resObj.user.identity.low },
      String(process.env.JWT_KEY)
    );
    const session = neo4jDriver.session();
    const data = await session.run(
      `match (user:User) where ID(user)=${resObj.user.identity.low} set user.tokens = ["${token}"] return user`
    );
    const withToken: any = data.records[0].toObject();
    await redisSet({
      key: resObj.user.identity.low,
      expiration: 3600,
      val: JSON.stringify(withToken.user.properties),
    });
    return { ...res.records[0].get(0).properties, token: token };
  } catch (e) {
    console.log(e.message);
    throw new Error(e);
  }
}
export async function isUserAuthorized({ token }: { token: string }) {
  try {
    const userDet: any = verify(token, String(process.env.JWT_KEY));
    const det = JSON.parse(
      String(await redisGet(userDet.id ? userDet.id : userDet.email))
    );
    if (!det) {
      const session = neo4jDriver.session();
      const result = await session.run(
        `match (user:User) where ID(user)=${userDet.id} return user`
      );
      const UserObj: any = result.records[0].toObject();
      const UserProperties = UserObj.user.properties;
      const index = UserProperties.tokens.findIndex((val: any) => val == token);
      await redisSet({
        key: userDet.id,
        expiration: 3600,
        val: UserProperties,
      });
      if (index == -1) return false;
      return true;
    } else {
      const index = det.tokens.findIndex((val: any) => val == token);
      if (index != -1) return true;
      return false;
    }
  } catch (e) {
    return false;
  }
}
export async function userLogout({
  all = false,
  token,
}: {
  all?: boolean;
  token: string;
}) {
  try {
    const session = neo4jDriver.session();
    const { id }: any = verify(token, String(process.env.JWT_KEY));
    const { records } = await session.run(
      `match (user:User) where ID(user)=${id} return user`
    );
    const userObj: any = records[0].toObject();
    const tokensArr = userObj.user.properties.tokens;
    const index = tokensArr.findIndex((val: string) => val == token);
    if (index != -1) {
      if (all) {
        await session.run(
          `match (user:User) where ID(user)=${id} set user.tokens = []`
        );
        await redisClient.del(id);
        return true;
      } else {
        const newTokens = JSON.stringify(
          tokensArr.filter((val: any) => val != token)
        );
        await session.run(
          `match (user:User) where ID(user)=${id} set user.tokens=${newTokens} return user`
        );
        return true;
      }
    } else {
      throw new Error("Not A Valid Token");
    }
  } catch (e) {
    throw new Error(e.message);
  }
}

export async function loginUser(phoneOrEmail: string, password: string) {
  try {
    let isEmail = validator.isEmail(phoneOrEmail);
    const session = neo4jDriver.session();
    const result = isEmail
      ? await session.run(
          `match (user:User {email:'${phoneOrEmail}'}) return user`
        )
      : await session.run(
          `match (user:User {phone:'${phoneOrEmail}'}) return user`
        );
    if (result.records[0]) {
      const UserData: any = result.records[0].toObject();
      const isAuthorized = await compare(
        password,
        UserData.user.properties.password
      );
      if (isAuthorized) {
        const userId = UserData.user.identity.low;
        const token = sign(
          { id: UserData.user.identity.low },
          String(process.env.JWT_KEY?.toString())
        );
        const tokens = tokensMerger(UserData.user.properties.tokens, token);
        const userDat: any = (
          await session.run(
            `match (user) where ID(user)=${userId} set user.tokens=${tokens} return user`
          )
        ).records[0].toObject();
        await redisSet({
          key: String(userId),
          expiration: 3600,
          val: JSON.stringify(userDat.user.properties),
        });
        return { token, ...userDat.user.properties };
      } else {
        throw new Error("Wrong Credentials");
      }
    } else {
      throw new Error("User Doesn't Exists");
    }
  } catch (e) {
    throw new Error(e.message);
  }
}

export function promisifyGraphQuery(
  query: string,
  payload?: any
): Promise<QueryResult> {
  const session = neo4jDriver.session();
  return new Promise((res, rej) => {
    session
      .run(query, payload)
      .then((val) => {
        res(val);
        session.close();
      })
      .catch((e) => {
        rej(new Error(parseError(e)));
        session.close();
      });
  });
}

function parseError(e: any) {
  if (e.code == "Neo.ClientError.Schema.ConstraintValidationFailed") {
    const arr = e.message.split(" ");
    const index = arr.findIndex((val: any) => val == "=");
    return `${arr[index - 1].replace("`", "").toUpperCase()} Is Already Taken`;
  }
  return e.message;
}

function tokensMerger(tokensArr: string[], token: string) {
  return JSON.stringify([...tokensArr, token]);
}

export function redisSet({
  key,
  val,
  expiration,
}: {
  key: string;
  val: string;
  expiration: number;
}) {
  return new Promise((res, rej) => {
    if (expiration) {
      redisClient.setex(key, expiration, val, (err, result) => {
        if (err) return rej(err);
        res(result);
      });
    } else {
      redisClient.set(key, val, (err, val) => {
        if (err) return rej(err);
        res(val);
      });
    }
  });
}
export function redisGet(key: string) {
  return new Promise((res, rej) => {
    redisClient.get(key, (err, val) => {
      if (err) return rej(err);
      res(val);
    });
  });
}

//todo
//done -- remove that email dependency from redis
//done -- complete isAuthorize
//done -- complete logout
// make a file to put constraints on the database

//testing
// logout({
//   all: false,
//   token:
//     "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NTMsImlhdCI6MTYwMDYyMTUyMX0.oo_dYqxSujHlR0gi2CdUoi3wILisv9kjRaySx4ktoYc",
// });
// isUserAuthorized({
//   token:
//     "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NTMsImlhdCI6MTYwMDYyMTUxNn0.dP6sxcPdFTxnt3BcRFilq1eAnKSgxV3-PRaGkv1ZlCg",
// }).then((val) => console.log(val));
// loginUser("8178808611", "paraskanwar");
