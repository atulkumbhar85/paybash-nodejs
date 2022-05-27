require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const { Configuration, PlaidApi, PlaidEnvironments } = require("plaid");
const app = express();
const moment = require("moment");
const cors = require("cors");

const APP_PORT = process.env.APP_PORT || 8000;

// Creates a session key, which we can use to store the user's access token
// (Convenient for demo purposes, bad for a production-level app)
app.use(cors());

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    saveUninitialized: true,
    resave: true,
  })
);

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static("public"));

const server = app.listen(APP_PORT, function () {
  console.log(
    `We're up and running. Head on over to http://localhost:${APP_PORT}/`
  );
});

// Configuration for the Plaid client
const config = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
      "PLAID-SECRET": process.env.PLAID_SECRET,
      "Plaid-Version": "2020-09-14",
    },
  },
});

//Instantiate the Plaid client with the configuration
const client = new PlaidApi(config);

// Checks whether or not the user has an access token for a financial
// institution
app.get("/api/is_user_connected", async (req, res, next) => {
  console.log(`Our access token: ${req.session.access_token}`);
  return req.session.access_token
    ? res.json({ status: true })
    : res.json({ status: false });
});

// Retrieves the name of the bank that we're connected to
app.get("/api/get_bank_name", async (req, res, next) => {
  const access_token = req.session.access_token;
  const itemResponse = await client.itemGet({ access_token });
  const configs = {
    institution_id: itemResponse.data.item.institution_id,
    country_codes: ["US"],
  };
  const instResponse = await client.institutionsGetById(configs);
  console.log(`Institution Info: ${JSON.stringify(instResponse.data)}`);
  const bankName = instResponse.data.institution.name;
  console.log('====================================');
  console.log(bankName);
  console.log('====================================');
  res.json({ name: bankName });
});

//Creates a Link token and returns it
app.get("/api/create_link_token", async (req, res, next) => {
  console.log('====================================');
  console.log("create token called")
  console.log('====================================');
  const tokenResponse = await client.linkTokenCreate({
    user: { client_user_id: req.sessionID },
    client_name: "Vanilla JavaScript Sample",
    language: "en",
    products: ["auth","transactions","identity"],
    country_codes: ["US"],
    // redirect_uri: "http://localhost:3000/about",
    android_package_name: "com.paybash"
  });
  console.log(`Token response: ${JSON.stringify(tokenResponse.data)}`);

  res.json(tokenResponse.data);
});

// Exchanges the public token from Plaid Link for an access token
app.post("/api/exchange_public_token", async (req, res, next) => {
  let PUBLIC_TOKEN = req.body.public_token;
  Promise.resolve()
    .then(async function () {
      const tokenResponse = await client.itemPublicTokenExchange({
        public_token: PUBLIC_TOKEN,
      });
      ACCESS_TOKEN = tokenResponse.data.access_token;
      ITEM_ID = tokenResponse.data.item_id;
      console.log(ACCESS_TOKEN);
      console.log(ITEM_ID);
      req.session.access_token = ACCESS_TOKEN;
      res.json({
        access_token: ACCESS_TOKEN,
        item_id: ITEM_ID,
        error: null,
        status: true,
      });
    })
    .catch(next);

  // FOR DEMO PURPOSES ONLY
  // You should really store access tokens in a database that's tied to your
  // authenticated user id.
  // console.log(`Exchange response: ${JSON.stringify(exchangeResponse.data)}`);
  
  // res.json(true);
});

// Fetches balance data using the Node client library for Plaid
app.get("/api/transactions", async (req, res, next) => {
  const access_token = req.session.access_token;
  const startDate = moment().subtract(30, "days").format("YYYY-MM-DD");
  const endDate = moment().format("YYYY-MM-DD");

  const transactionResponse = await client.transactionsGet({
    access_token: access_token,
    start_date: startDate,
    end_date: endDate,
    options: { count: 10 },
  });
  res.json(transactionResponse.data);
});

app.get('/api/accountBalance', async (req, res) => {
  console.log('====================================');
  console.log("Balance called");
  console.log('====================================');
  const request = {
    access_token: req.session.access_token,
  };
  try {
    const response = await client.accountsBalanceGet(request);
    const accounts = response.data.accounts;
    console.log('====================================');
    console.log(accounts);
    console.log('====================================');
    res.json(accounts);
  } catch (error) {
    // handle error
    console.log('====================================');
    console.log(error);
    console.log('====================================');
  }
})

app.get('/api/userInfo', async (req, res) => {
  console.log('====================================');
  console.log("Info called");
  console.log('====================================');
  const request = {
    access_token: req.session.access_token,
  };
  try {
    const response = await client.identityGet(request);
    const identities = response.data.accounts.flatMap(
      (account) => account.owners,
    );
    console.log('====================================');
    console.log(identities);
    console.log('====================================');
    res.json(identities);
  } catch (error) {
    // handle error
    console.log('====================================');
    console.log(error);
    console.log('====================================');
  }
})

app.listen(process.env.PORT || 8080);