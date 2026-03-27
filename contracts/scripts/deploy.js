const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const Token = await ethers.getContractFactory("TzeroSecurityToken");
  const token = await Token.deploy(
    "Tzero Test Asset",   // name
    "TZTST",              // symbol
    4200000000,           // pre-money valuation in cents ($42M)
    12,                   // lock-up months
    true,                 // requires accredited investors
    deployer.address      // owner
  );

  await token.waitForDeployment();
  const address = await token.getAddress();
  console.log("TzeroSecurityToken deployed to:", address);
  return address;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
