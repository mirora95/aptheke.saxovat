using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Saxovat.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOneCMedicineSync : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ExternalId",
                table: "medicines",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastSyncedAt",
                table: "medicines",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_medicines_ExternalId",
                table: "medicines",
                column: "ExternalId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_medicines_ExternalId",
                table: "medicines");

            migrationBuilder.DropColumn(
                name: "ExternalId",
                table: "medicines");

            migrationBuilder.DropColumn(
                name: "LastSyncedAt",
                table: "medicines");
        }
    }
}
