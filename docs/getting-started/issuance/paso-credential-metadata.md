# PaSO Issuer-side Credential Metadata

EUDIPLO supports the **Issuer / Attestation Provider** obligations of the [PaSO Proof: Metadata Module](https://github.com/openwallet-foundation-labs/payments-and-sca-for-openid/blob/main/docs/specs/proof/paso-proof-metadata.md). This extension allows an issuer to advertise transaction data types supported by its credentials, serve signed credential metadata carrying these capabilities, and bind that metadata cryptographically to the credential's existing attestation key chain.

This page describes how to configure PaSO metadata on your credentials, discover the endpoint, and understand the content negotiation behavior.

---

## Overview of PaSO Roles

In a PaSO (Payments and Strong Customer Authentication) ecosystem:

1. **Issuer / Attestation Provider (EUDIPLO)**: Deploys credential configurations carrying the `paso` block. It issues the credentials and hosts the signed/unsigned `credential_metadata_uri` endpoint carrying `transaction_data_types`.
2. **Wallet**: Resolves the signed `credential_metadata_uri` during transaction requests, verifies its cryptographic binding to the credential's attestation certificate, and displays the transaction details securely to the user.
3. **Verifier**: Initiates presentation requests with `transaction_data` and validates presentation proofs.

!!! info "EUDIPLO supports the Issuer role only"
    This feature implements issuer-side obligations. EUDIPLO does **not** enforce or validate PaSO transaction presentations on the verifier side. For verifier-side transaction data hashing, refer to standard OID4VP [Transaction Data](../presentation/transaction-data.md) documentation.

---

## Configuration

To enable PaSO on a credential, add a `paso` configuration block to your `CredentialConfig` payload (typically POST/PUT on `/issuer/credentials`).

### PaSO Configuration Properties

- **`transactionDataTypes`**: A map of PaSO transaction data types keyed by their standard URN (`urn:paso:sca:<domain>:<suffix>:<version>`).
  - **`claims`**: Array of claims required for this transaction type.
    - **`path`**: JSON path pointing to the claim in the credential (e.g. `["payment_details", "amount"]`).
    - **`mandatory`**: Whether the claim is mandatory.
    - **`display`**: Localized display names and options for the field.
    - **`value_type`**: Type of the value (only allowed if `display` is present) as defined in the ecosystem rulebook (e.g. `currency-amount`).
  - **`ui_labels`**: Optional localized UI labels (e.g. `affirmative_action_label`, `denial_action_label`, `transaction_title`, `security_hint`) to customize the user consent screen in the wallet.
- **`signedMetadataLifetimeSeconds`**: Lifetime of the signed metadata JWT in seconds (default: `86400` / 24 hours).

### Worked Example

The following is an example payload for creating an SD-JWT credential configuration with PaSO support:

```json
{
  "id": "sca-payment",
  "keyChainId": "c3f24b6e-9b71-4b62-8d37-5f1a2c9e47ad",
  "description": "SCA Payment Card",
  "config": {
    "scope": "sca-payment",
    "format": "dc+sd-jwt",
    "display": [
      {
        "name": "SCA Card",
        "description": "SCA Card for Payment Authorization",
        "locale": "en",
        "background_color": "#123456",
        "text_color": "#FFFFFF"
      }
    ]
  },
  "vct": "https://bank.example/sca/card",
  "keyBinding": true,
  "statusManagement": true,
  "lifeTime": 604800,
  "fields": [
    {
      "path": ["payment_details", "amount"],
      "type": "string",
      "defaultValue": "100.00",
      "mandatory": true,
      "disclosable": true
    }
  ],
  "paso": {
    "transactionDataTypes": {
      "urn:paso:sca:global:payment:1": {
        "claims": [
          {
            "path": ["payment_details", "amount"],
            "mandatory": true,
            "display": [
              {
                "locale": "en",
                "name": "Amount",
                "display_type": "amount"
              }
            ],
            "value_type": "currency-amount"
          }
        ],
        "ui_labels": {
          "affirmative_action_label": [
            {
              "locale": "en",
              "value": "Authorize Payment"
            }
          ]
        }
      }
    },
    "signedMetadataLifetimeSeconds": 86400
  }
}
```

---

## Discovery and Endpoints

### 1. Discovering the Metadata URI
When a credential is configured with PaSO, its entry in the OID4VCI well-known issuer metadata (`GET /.well-known/openid-credential-issuer/issuers/:tenantId`) automatically includes the `credential_metadata_uri` property:

```json
{
  "credential_issuer": "https://example.com/issuers/root",
  "credential_configurations_supported": {
    "sca-payment": {
      "format": "dc+sd-jwt",
      "vct": "https://bank.example/sca/card",
      "credential_metadata_uri": "https://example.com/.well-known/openid-credential-issuer/issuers/root/credential-metadata/sca-payment"
    }
  }
}
```

### 2. Resolving the Metadata (Content Negotiation)
The `credential_metadata_uri` endpoint supports standard HTTP content negotiation via the `Accept` header and locale selection via the `Accept-Language` header:

#### Unsigned JSON Metadata
- **Request**: `Accept: application/json`, `Accept-Language: de`
- **Response**: The raw JSON metadata carrying `display`, `claims`, and `transaction_data_types` filtered to the requested locale. If no matching locale is found, EUDIPLO falls back to the default display locale.

#### Signed JWT Metadata
- **Request**: `Accept: application/jwt`, `Accept-Language: de`
- **Response**: A signed JWT with a JOSE header carrying:
  - `typ`: `"credential-metadata+jwt"`
  - `x5c`: The credential's attestation certificate chain (proving cryptographic binding).
  
  And payload carrying:
  - `iss`: Issuer identifier URL
  - `sub`: Credential type identifier (`vct` for SD-JWT VC, `docType` for mdoc)
  - `format`: Credential format
  - `iat` / `exp`: Issued at / Expiration timestamps
  - `credential_metadata_uri`: The discoverable URL of this metadata
  - `credential_metadata`: The OID4VCI credential metadata object carrying the locale-filtered transaction data types.

---

## Cryptographic Binding

To prevent substitution attacks, the PaSO specification requires that the signed metadata JWT is issued and signed by the same key chain and certificate authority that issues the credential's attestation.

EUDIPLO satisfies this requirement by automatically resolving the certificate using the `keyChainId` configured on the credential. 
- The JWT is signed using the `KeyUsageType.Attestation` certificate chain.
- The root and leaf certificates in the metadata JWT's `x5c` header will perfectly match the certificates used to issue the actual credentials, allowing wallets to perform cryptographic binding checks securely.

!!! warning "Cert Rotation and Cache Invalidation"
    When the credential's attestation key chain rotates, previously issued metadata JWTs will eventually fail validation when their cached versions expire. Wallets will automatically re-fetch before the JWT's `exp` is reached, governed by `signedMetadataLifetimeSeconds`.
