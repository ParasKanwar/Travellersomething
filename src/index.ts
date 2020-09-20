require("./env");
import express from "express";
import { graphqlHTTP } from "express-graphql";
import { ApiSchema } from "./graphql/schema";
import { ApiResolver } from "./graphql/resolver";
const PORT = process.env.PORT;
const app = express();
app.use(
  "/api",
  graphqlHTTP({ rootValue: ApiResolver, schema: ApiSchema, graphiql: true })
);
app.listen(PORT, () => {
  console.log(`Hello TravellerStop is listening on port ${PORT}`);
});
