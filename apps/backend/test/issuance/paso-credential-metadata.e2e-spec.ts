import { join } from "node:path";
import { INestApplication } from "@nestjs/common";
import { decodeJwt, decodeProtectedHeader } from "jose";
import request from "supertest";
import { App } from "supertest/types";
import { Agent, setGlobalDispatcher } from "undici";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
    IssuanceTestContext,
    readConfig,
    setupIssuanceTestApp,
} from "../utils";

setGlobalDispatcher(
    new Agent({
        connect: {
            rejectUnauthorized: false,
        },
    }),
);

describe("Issuance - PaSO Credential Metadata E2E", () => {
    let app: INestApplication<App>;
    let authToken: string;
    let ctx: IssuanceTestContext;

    beforeAll(async () => {
        ctx = await setupIssuanceTestApp();
        app = ctx.app;
        authToken = ctx.authToken;

        // Try importing sca-payment credential configuration manually and log details if 400
        const configFolder = join(__dirname, "../fixtures");
        const scaPaymentData = readConfig(
            join(configFolder, "haip/issuance/credentials/sca-payment.json"),
        );

        const res = await request(app.getHttpServer())
            .post("/issuer/credentials")
            .trustLocalhost()
            .set("Authorization", `Bearer ${authToken}`)
            .send(scaPaymentData);

        if (res.status !== 201) {
            console.error(
                "FAILED TO IMPORT SCA PAYMENT CONFIG:",
                JSON.stringify(res.body, null, 2),
            );
            throw new Error(`Import failed with status ${res.status}`);
        }
    });

    afterAll(async () => {
        await app.close();
    });

    test("1. Well-known metadata includes credential_metadata_uri for sca-payment, but not for pid", async () => {
        const res = await request(app.getHttpServer())
            .get("/.well-known/openid-credential-issuer/issuers/root")
            .trustLocalhost();

        if (res.status !== 200) {
            console.error(
                "WELL-KNOWN METADATA GET FAILED:",
                JSON.stringify(res.body, null, 2),
            );
        }
        expect(res.status).toBe(200);

        const metadata = res.body;
        expect(metadata.credential_configurations_supported).toBeDefined();

        const scaConfig =
            metadata.credential_configurations_supported["sca-payment"];
        expect(scaConfig).toBeDefined();
        expect(scaConfig.credential_metadata_uri).toBeDefined();
        expect(scaConfig.credential_metadata_uri).toContain(
            "/.well-known/openid-credential-issuer/issuers/root/credential-metadata/sca-payment",
        );

        const pidConfig =
            metadata.credential_configurations_supported["pid-no-key"];
        expect(pidConfig).toBeDefined();
        expect(pidConfig.credential_metadata_uri).toBeUndefined();
    });

    test("2. Unsigned JSON metadata is returned and properly filtered by Accept-Language", async () => {
        const res = await request(app.getHttpServer())
            .get(
                "/.well-known/openid-credential-issuer/issuers/root/credential-metadata/sca-payment",
            )
            .trustLocalhost()
            .set("Accept", "application/json")
            .set("Accept-Language", "de")
            .expect(200);

        const metadata = res.body;

        // Display list filtered to German (locale: de)
        expect(metadata.display).toHaveLength(1);
        expect(metadata.display[0].locale).toBe("de");
        expect(metadata.display[0].name).toBe("SCA Karte");

        // Claims displays filtered to German
        expect(metadata.claims).toBeDefined();
        for (const claim of metadata.claims) {
            expect(claim.display).toHaveLength(1);
            expect(claim.display[0].locale).toBe("de");
        }

        // PaSO transaction data types filtered to German
        const pasoTdt =
            metadata.transaction_data_types["urn:paso:sca:global:payment:1"];
        expect(pasoTdt).toBeDefined();

        // PaSO claim displays filtered to German
        for (const claim of pasoTdt.claims) {
            expect(claim.display).toHaveLength(1);
            expect(claim.display[0].locale).toBe("de");
        }

        // PaSO UI labels filtered to German
        expect(pasoTdt.ui_labels.affirmative_action_label).toHaveLength(1);
        expect(pasoTdt.ui_labels.affirmative_action_label[0].locale).toBe("de");
        expect(pasoTdt.ui_labels.affirmative_action_label[0].value).toBe(
            "Zahlung freigeben",
        );
    });

    test("3. Signed JWT metadata is returned with correct typ, binding headers and payload attributes", async () => {
        const res = await request(app.getHttpServer())
            .get(
                "/.well-known/openid-credential-issuer/issuers/root/credential-metadata/sca-payment",
            )
            .trustLocalhost()
            .set("Accept", "application/jwt")
            .set("Accept-Language", "en")
            .expect(200);

        const jwtToken = res.text;
        expect(typeof jwtToken).toBe("string");

        // Decode protected header
        const header = decodeProtectedHeader(jwtToken);
        expect(header.typ).toBe("credential-metadata+jwt");
        expect(header.alg).toBeDefined();
        expect(header.x5c).toBeDefined();
        expect(Array.isArray(header.x5c)).toBe(true);
        expect(header.x5c!.length).toBeGreaterThan(0);

        // Decode payload
        const payload: any = decodeJwt(jwtToken);
        expect(payload.iss).toContain("/issuers/root");
        expect(payload.sub).toBe("https://bank.example/sca/card");
        expect(payload.format).toBe("dc+sd-jwt");
        expect(payload.iat).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
        expect(payload.exp).toBeGreaterThan(payload.iat);
        expect(payload.credential_metadata_uri).toContain(
            "/.well-known/openid-credential-issuer/issuers/root/credential-metadata/sca-payment",
        );

        // Nested metadata display should filter to English
        const metadata = payload.credential_metadata;
        expect(metadata.display).toHaveLength(1);
        expect(metadata.display[0].locale).toBe("en");
        expect(metadata.display[0].name).toBe("SCA Card");
    });

    test("4. Creating a credential config with a non-conformant URN key should be rejected (400)", async () => {
        const invalidUrnConfig = {
            id: "invalid-paso-urn",
            keyChainId: "c3f24b6e-9b71-4b62-8d37-5f1a2c9e47ad",
            description: "Invalid PaSO URN key config",
            config: {
                scope: "invalid-paso-urn",
                format: "dc+sd-jwt",
                display: [
                    {
                        name: "Invalid Card",
                        locale: "en",
                        description: "Invalid Card Description",
                    },
                ],
            },
            vct: "https://bank.example/invalid/card",
            fields: [],
            paso: {
                transactionDataTypes: {
                    "urn:not-paso:sca:global:payment:1": {
                        claims: [],
                    },
                },
            },
        };

        const res = await request(app.getHttpServer())
            .post("/issuer/credentials")
            .trustLocalhost()
            .set("Authorization", `Bearer ${authToken}`)
            .send(invalidUrnConfig)
            .expect(400);

        const hasError = res.body.message.some((msg: string) =>
            msg.includes(
                "Each key in transactionDataTypes must match the pattern",
            ),
        );
        expect(hasError).toBe(true);
    });

    test("5. Creating a credential config with value_type but no display in claims should be rejected (400)", async () => {
        const invalidClaimsConfig = {
            id: "invalid-paso-claims",
            keyChainId: "c3f24b6e-9b71-4b62-8d37-5f1a2c9e47ad",
            description: "Invalid PaSO claims config",
            config: {
                scope: "invalid-paso-claims",
                format: "dc+sd-jwt",
                display: [
                    {
                        name: "Invalid Claims Card",
                        locale: "en",
                        description: "Invalid Claims Card Description",
                    },
                ],
            },
            vct: "https://bank.example/invalid/claims-card",
            fields: [],
            paso: {
                transactionDataTypes: {
                    "urn:paso:sca:global:payment:1": {
                        claims: [
                            {
                                path: ["amount"],
                                mandatory: true,
                                value_type: "currency-amount",
                                // missing 'display' array!
                            },
                        ],
                    },
                },
            },
        };

        const res = await request(app.getHttpServer())
            .post("/issuer/credentials")
            .trustLocalhost()
            .set("Authorization", `Bearer ${authToken}`)
            .send(invalidClaimsConfig)
            .expect(400);

        const hasError = res.body.message.some((msg: string) =>
            msg.includes(
                "value_type can only be specified when display is present and not empty",
            ),
        );
        expect(hasError).toBe(true);
    });
});
