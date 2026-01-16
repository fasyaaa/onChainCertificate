import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.8.1/dist/ethers.min.js";

const CONTRACT_ADDRESS = "0x603DF026AF194cE8460f4a438d42191e0870833A";
const ABI_URL = "./abi.json";
const SEPOLIA_CHAIN_ID = "0xaa36a7";
let provider;
let signer;
let contract;

if (window.ethereum) {
  window.ethereum.on("chainChanged", () => {
    window.location.reload();
  });
  window.ethereum.on("accountsChanged", () => {
    logout();
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const sessionUser = localStorage.getItem("userAddress");
  const sessionDevice = localStorage.getItem("deviceIdentifier");

  if (sessionUser && sessionDevice) {
    await checkLoginSession(sessionUser, sessionDevice);
  }
});

async function checkLoginSession(address, deviceId) {
  if (!window.ethereum) return;

  provider = new ethers.BrowserProvider(window.ethereum);
  signer = await provider.getSigner();

  const currentAddress = await signer.getAddress();

  if (currentAddress.toLowerCase() === address.toLowerCase()) {
    const storedDeviceId = localStorage.getItem("deviceIdentifier");
    if (storedDeviceId === deviceId) {
      enableAdminMode(currentAddress);
    } else {
      alert("Sesi login terdeteksi di perangkat lain. Silakan login ulang.");
      logout();
    }
  } else {
    logout();
  }
}

async function login() {
  if (!window.ethereum) {
    alert("MetaMask tidak ditemukan!");
    return;
  }

  try {
    provider = new ethers.BrowserProvider(window.ethereum);

    const network = await provider.getNetwork();
    if ("0x" + network.chainId.toString(16) !== SEPOLIA_CHAIN_ID) {
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: SEPOLIA_CHAIN_ID }],
        });
      } catch (err) {
        alert("Harap ganti network ke Sepolia.");
        return;
      }
    }

    await provider.send("eth_requestAccounts", []);
    signer = await provider.getSigner();
    const address = await signer.getAddress();

    const message = `Login request for Certificate DApp\nWallet: ${address}\nTimestamp: ${Date.now()}`;
    const signature = await signer.signMessage(message);

    const recoveredAddress = ethers.verifyMessage(message, signature);

    if (recoveredAddress.toLowerCase() === address.toLowerCase()) {
      const deviceId = crypto.randomUUID();
      localStorage.setItem("userAddress", address);
      localStorage.setItem("deviceIdentifier", deviceId);
      localStorage.setItem("loginSignature", signature);

      enableAdminMode(address);
    } else {
      alert("Verifikasi tanda tangan gagal!");
    }
  } catch (error) {
    console.error("Login error:", error);
    alert("Login gagal: " + error.message);
  }
}

function enableAdminMode(address) {
  document.getElementById("uploadSection").classList.remove("hidden");
  document.getElementById("btnLogin").classList.add("hidden");
  document.getElementById("btnLogout").classList.remove("hidden");
  document.getElementById("account").innerText =
    "Admin: " + address.substring(0, 6) + "...";
  document.getElementById("account").style.color = "#34d399";

  initContract();
}

function logout() {
  localStorage.removeItem("userAddress");
  localStorage.removeItem("deviceIdentifier");
  localStorage.removeItem("loginSignature");

  document.getElementById("uploadSection").classList.add("hidden");
  document.getElementById("btnLogin").classList.remove("hidden");
  document.getElementById("btnLogout").classList.add("hidden");
  document.getElementById("account").innerText = "Guest Mode";
  document.getElementById("account").style.color = "#a0a0a0";

  location.reload();
}

async function initContract() {
  if (!contract && signer) {
    const abi = await fetch(ABI_URL).then((res) => res.json());
    contract = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);
  }
}

async function uploadCertificate() {
  if (!localStorage.getItem("userAddress")) {
    alert("Sesi habis. Silakan login kembali.");
    logout();
    return;
  }

  await initContract();

  const name = document.getElementById("studentName").value;
  const nim = document.getElementById("studentId").value;
  const major = document.getElementById("program").value;
  const year = document.getElementById("year").value;
  const wallet = document.getElementById("studentWallet").value;
  const fileInput = document.getElementById("file");
  const resultDisplay = document.getElementById("uploadResult");
  const btnUpload = document.getElementById("btnUpload");

  if (!fileInput.files.length || !name || !nim || !wallet) {
    alert("Data belum lengkap!");
    return;
  }

  try {
    btnUpload.disabled = true;
    btnUpload.innerText = "⏳ Uploading...";
    resultDisplay.style.display = "block";
    resultDisplay.innerHTML = "Upload ke IPFS...";

    const formData = new FormData();
    formData.append("file", fileInput.files[0]);
    const fileRes = await fetch("http://localhost:3001/upload", {
      method: "POST",
      body: formData,
    });
    const fileData = await fileRes.json();
    const fileIPFS = `ipfs://${fileData.ipfsHash}`;

    const metadata = {
      name: `Sertifikat ${name}`,
      description: "Sertifikat Digital UMY",
      image: fileIPFS,
      attributes: [
        { trait_type: "Nama", value: name },
        { trait_type: "NIM", value: nim },
        { trait_type: "Program Studi", value: major },
        { trait_type: "Tahun", value: year },
      ],
    };

    const metaRes = await fetch("http://localhost:3001/upload-json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(metadata),
    });
    const metaData = await metaRes.json();
    const metadataURI = `ipfs://${metaData.ipfsHash}`;

    btnUpload.innerText = "🦊 Konfirmasi di Wallet...";

    const tx = await contract.mintCertificate(wallet, metadataURI, nim);

    const etherscanLink = `https://sepolia.etherscan.io/tx/${tx.hash}`;
    btnUpload.innerText = "⏳ Minting...";
    resultDisplay.innerHTML = `🚀 Transaksi dikirim! <a href="${etherscanLink}" target="_blank" style="color:cyan">Cek Etherscan</a>`;

    await tx.wait();

    resultDisplay.className = "result-box result-success";
    resultDisplay.innerHTML = `✅ <b>SUKSES!</b> NIM ${nim} berhasil didaftarkan.<br><a href="${etherscanLink}" target="_blank" style="color:white; text-decoration:underline">Lihat Bukti</a>`;
    alert("Sertifikat berhasil dicetak!");
  } catch (error) {
    console.error(error);
    resultDisplay.className = "result-box result-error";
    resultDisplay.innerHTML = `❌ Gagal: ${error.message}`;
  } finally {
    btnUpload.disabled = false;
    btnUpload.innerText = "Mint Certificate 🚀";
  }
}

async function verifyCertificate() {
  const nimInput = document.getElementById("verifyNim").value;
  const resultDisplay = document.getElementById("verifyResult");

  if (!nimInput) {
    alert("Masukkan NIM!");
    return;
  }

  let readProvider;
  if (window.ethereum) {
    readProvider = new ethers.BrowserProvider(window.ethereum);
  } else {
    readProvider = new ethers.JsonRpcProvider(
      "https://ethereum-sepolia-rpc.publicnode.com"
    );
  }

  try {
    const abi = await fetch(ABI_URL).then((res) => res.json());
    const readContract = new ethers.Contract(
      CONTRACT_ADDRESS,
      abi,
      readProvider
    );

    resultDisplay.style.display = "block";
    resultDisplay.innerHTML = "🔍 Mencari data di Blockchain...";

    const tokenIdBigInt = await readContract.nimToTokenId(nimInput);
    const tokenId = Number(tokenIdBigInt);

    if (tokenId === 0) {
      throw new Error("NIM tidak terdaftar di Blockchain.");
    }

    const owner = await readContract.ownerOf(tokenId);
    const uri = await readContract.tokenURI(tokenId);
    const httpUri = uri.replace(
      "ipfs://",
      "https://gateway.pinata.cloud/ipfs/"
    );

    let detailsHtml = "";
    try {
      const metaRes = await fetch(httpUri);
      const metaJson = await metaRes.json();

      const namaAttr =
        metaJson.attributes.find((a) => a.trait_type === "Nama")?.value || "-";
      const prodiAttr =
        metaJson.attributes.find((a) => a.trait_type === "Program Studi")
          ?.value || "-";
      const imgUrl = metaJson.image.replace(
        "ipfs://",
        "https://gateway.pinata.cloud/ipfs/"
      );

      detailsHtml = `
                <div style="margin-top:10px; display:flex; gap:15px; align-items:start;">
                    <img src="${imgUrl}" width="100" style="border-radius:8px; border:1px solid #555;">
                    <div>
                        <h3 style="margin:0; color:#4CAF50;">${namaAttr}</h3>
                        <p style="margin:5px 0 0 0; color:#ddd;">${prodiAttr}</p>
                        <small style="color:#aaa;">NIM: ${nimInput}</small>
                    </div>
                </div>
            `;
    } catch (e) {
      console.log("Gagal fetch metadata detail", e);
    }

    resultDisplay.className = "result-box result-success";
    resultDisplay.innerHTML = `
            <h4 style="margin:0; color:#6ee7b7;">✅ SERTIFIKAT VALID</h4>
            <div style="font-size:0.9rem; margin-top:5px; color:#ccc;">
                Token ID: ${tokenId} <br>
                Owner Wallet: ${owner.substring(0, 6)}...${owner.substring(38)}
            </div>
            ${detailsHtml}
        `;
  } catch (error) {
    console.error(error);
    resultDisplay.className = "result-box result-error";
    resultDisplay.innerHTML = `
            <h4 style="margin:0; color:#fca5a5;">❌ GAGAL / TIDAK DITEMUKAN</h4>
            <p style="margin:5px 0;">${
              error.message || "Data tidak ditemukan."
            }</p>
        `;
  }
}

window.login = login;
window.logout = logout;
window.uploadCertificate = uploadCertificate;
window.verifyCertificate = verifyCertificate;
