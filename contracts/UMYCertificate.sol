// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract UMYCertificate is ERC721URIStorage, Ownable {

    uint256 public nextTokenId;
    
    mapping(string => uint256) public nimToTokenId;

    constructor()
        ERC721("UMY Certificate", "UMYCERT")
        Ownable(msg.sender)
    {
        nextTokenId = 1;
    }

    function mintCertificate(
        address recipient,
        string memory metadataURI,
        string memory _nim // Tambah parameter NIM
    ) public onlyOwner {
        require(nimToTokenId[_nim] == 0, "NIM ini sudah memiliki sertifikat!");

        uint256 tokenId = nextTokenId;
        nextTokenId++;

        _safeMint(recipient, tokenId);
        _setTokenURI(tokenId, metadataURI);
        
        nimToTokenId[_nim] = tokenId;
    }
}