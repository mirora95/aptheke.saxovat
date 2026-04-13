using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Saxovat.Infrastructure.Persistence.Migrations
{
    public partial class AddCategoryIcon : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Icon",
                table: "categories",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Icon",
                table: "categories");
        }
    }
}
