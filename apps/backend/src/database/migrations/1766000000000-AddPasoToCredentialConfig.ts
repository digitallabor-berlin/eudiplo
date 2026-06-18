import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

/**
 * Add paso column to credential_config table.
 *
 * This migration adds a JSON column to store PaSO-specific configuration
 * for PaSO Issuer-side Credential Metadata (signed credential_metadata_uri).
 * The column is optional; when present, the GET /.well-known/openid-credential-issuer/issuers/:tenantId/credential-metadata/:credentialId
 * endpoint can generate a CredentialMetadata document and signed JWT per the PaSO specification.
 */
export class AddPasoToCredentialConfig1766000000000
    implements MigrationInterface
{
    name = "AddPasoToCredentialConfig1766000000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable("credential_config");
        if (!table) {
            console.log(
                "[Migration] credential_config table not found — skipping (schema may not exist yet).",
            );
            return;
        }

        const hasColumn = table.columns.some((col) => col.name === "paso");
        if (hasColumn) {
            console.log("[Migration] paso column already exists — skipping.");
            return;
        }

        await queryRunner.addColumn(
            "credential_config",
            new TableColumn({
                name: "paso",
                type: "json",
                isNullable: true,
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable("credential_config");
        if (!table) {
            console.log(
                "[Migration] credential_config table not found — skipping.",
            );
            return;
        }

        const hasColumn = table.columns.some((col) => col.name === "paso");
        if (hasColumn) {
            await queryRunner.dropColumn("credential_config", "paso");
        }
    }
}
