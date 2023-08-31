/** @type import('hardhat/config').HardhatUserConfig */

require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  defaultNetwork: "ganachedev",
  networks:{
    ganachedev:{
      url: "http://127.0.0.1:8545"
    },
    besudev:{
      url: process.env.BESU_NODE1_ENDPOINT,
      accounts: {
        mnemonic: process.env.MNEMONIC_STRING,
        initialIndex: 0,
        count: 5,
        passphrase: "",
      }
    },
    goerliamb:{
      url: process.env.AMB_HTTP_TOKEN_URL,
      accounts: {
        mnemonic: process.env.MNEMONIC_STRING,
        initialIndex: 0,
        count: 5,
        passphrase: "",
      }
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  solidity: "0.8.18"
};
