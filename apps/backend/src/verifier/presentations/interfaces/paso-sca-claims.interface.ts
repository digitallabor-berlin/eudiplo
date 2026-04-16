/**
 * Represents the PaSO (Payments and SCA for OpenID) claims extracted from the 
 * cryptographic proof (e.g. SD-JWT Key Binding JWT or mDOC DeviceSigned).
 * Stored ephemerally during the session lifecycle.
 */
export interface PaSoScaClaims {
    jti: string; // The authentication code / unique nonce per presentation
    response_mode?: string;
    display_locale?: string;
    amr?: string[]; // Authentication Method References (e.g., ["pin", "bio_strong"])
    transaction_data_hash?: string;
    transaction_data_hash_alg?: string;
    metadata_integrity?: string;
    request_integrity?: string;
    wallet_instance_version?: string;
}