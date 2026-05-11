import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

/**
 * Add expected_origins column to presentation_config table.
 *
 * This migration adds an optional JSON column `expected_origins` so each
 * presentation configuration can declare the browser origins that the wallet
 * should validate against when the presentation is requested through the W3C
 * Digital Credentials API (DC API). When not set, the backend falls back to
 * the origin derived from the request that creates the presentation.
 */
export class AddExpectedOriginsToPresentationConfig1755000000000
    implements MigrationInterface
{
    name = "AddExpectedOriginsToPresentationConfig1755000000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable("presentation_config");
        if (!table) {
            console.log(
                "[Migration] presentation_config table not found — skipping (schema may not exist yet).",
            );
            return;
        }

        const hasColumn = table.columns.some(
            (col) => col.name === "expected_origins",
        );
        if (hasColumn) {
            console.log(
                "[Migration] expected_origins column already exists — skipping.",
            );
            return;
        }

        await queryRunner.addColumn(
            "presentation_config",
            new TableColumn({
                name: "expected_origins",
                type: "json",
                isNullable: true,
            }),
        );

        console.log(
            "[Migration] Added expected_origins column to presentation_config.",
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable("presentation_config");
        if (table) {
            const hasColumn = table.columns.some(
                (col) => col.name === "expected_origins",
            );
            if (hasColumn) {
                await queryRunner.dropColumn(
                    "presentation_config",
                    "expected_origins",
                );
                console.log(
                    "[Migration] Removed expected_origins column from presentation_config.",
                );
            }
        }
    }
}
