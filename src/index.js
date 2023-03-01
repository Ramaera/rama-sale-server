// src/index.js
require('dotenv').config()
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;


const { PrismaClient } = require('@prisma/client')
const Koa = require('koa')
const Router = require('@koa/router')
const { koaBody } = require('koa-body')
const cors = require('@koa/cors');

const Coinpayments = require("coinpayments")
const app = new Koa()
const router = new Router()
const config = require("./config")
const prisma = new PrismaClient()
const cron = require('node-cron');
const moment = require("moment");
const Web3 = require("web3");
const STAKING_ABI = require("./abi/StakingContract.json")
// const Web3HDWalletProvider = require("web3-hdwallet-provider");
var provider = new Web3.providers.HttpProvider(config.RPC);
const web3 = new Web3(provider);
const stakingContract = new web3.eth.Contract(STAKING_ABI, config.STAKING_CONTRACT);
const { address: admin } = web3.eth.accounts.wallet.add(process.env.ADMIN_PRIVATE_KEY)

const coinpaymentClient = new Coinpayments({
  key: process.env.COINPAYMENT_KEY,
  secret: process.env.COINPAYMENT_SECRET
})
router.get("/test", async (ctx) => {
  ctx.response.status = 201
  ctx.body = {
    message: 'Working',
  }
})



router.post('/createTxn', async (ctx) => {







  const options = {
    currency1: "usd",
    currency2: ctx.request.body.toCurrency,
    amount: ctx.request.body.usdAmount,
    buyer_email: "shahzeb@ramaera.com",
    custom: ctx.request.body.walletAddress
  }
  const resp = await coinpaymentClient.createTransaction(options)


  await prisma.purchase.create({
    data: {
      coinPaymentTxnId: resp.txn_id,
      ramaAmount: (ctx.request.body.usdAmount / config.RAMA_PRICE_USD).toString(),
      currency: ctx.request.body.toCurrency,
      usdAmount: ctx.request.body.usdAmount.toString(),
      ramaWallet: ctx.request.body.walletAddress,
      currencyAmount: resp.amount.toString(),
    }
  })

  ctx.response.status = 201
  ctx.body = {
    message: 'Txn Created',
    data: {
      checkout_url: resp.checkout_url,
      txn_id: resp.txn_id
    },
  }
})


app.use(koaBody())
app.use(cors())


const checkForUnmarkedPayments = async () => {

  const allUncheckedPayments = await prisma.purchase.findMany({
    where: {
      paymentStatus: {
        equals: 0
      }
    }
  });


  for (let payment of allUncheckedPayments) {
    const status = await coinpaymentClient.getTx({
      txid: payment.coinPaymentTxnId
    })

    await prisma.purchase.update({
      where: {
        id: payment.id
      },
      data: {
        paymentStatus: status.status
      },
    })

  }
}





const checkForStakedPayments = async () => {

  const allUnstakedPayments = await prisma.purchase.findMany({
    where: {
      isStaked: {
        equals: false
      },
      paymentStatus: {
        equals: 100
      }
    }
  });


  for (let payment of allUnstakedPayments) {
    console.log(payment)



    const gasPrice = await web3.eth.getGasPrice();
    const gasEstimate = await stakingContract.methods.stake(payment.ramaWallet).estimateGas({
      from: process.env.ADMIN_WALLET, value: Web3.utils.toWei(payment.ramaAmount),
    });

    const txn = await stakingContract.methods.stake(payment.ramaWallet).send(
      {
        value: Web3.utils.toWei(payment.ramaAmount),
        from: process.env.ADMIN_WALLET,
        gasPrice: gasPrice, gas: gasEstimate
      })




    await prisma.purchase.update({
      where: {
        id: payment.id
      },
      data: {
        stakingHash:txn.transactionHash,
        isStaked: true
      },
    })

  }
}






const initCrons = () => {
  cron.schedule('* * * * *', async () => {
    await checkForUnmarkedPayments()
    await checkForStakedPayments()
  });

}


app
  .use(router.routes())
  .use(router.allowedMethods())


const PORT = process.env.PORT
app.listen(PORT, () => {
  console.log(`Server running at: http://localhost:${PORT}`)
  initCrons()
})