async function main() {
  const Certificate = await ethers.getContractFactory("UMYCertificate");
  const certificate = await Certificate.deploy();

  await certificate.waitForDeployment();

  console.log(
    "UMYCertificate deployed to:",
    await certificate.getAddress()
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
