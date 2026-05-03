using System.Text.Json.Serialization;

namespace Saxovat.Application.Contracts;

public sealed class OneCProductDto
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("barcode")]
    public string Barcode { get; set; } = string.Empty;

    [JsonPropertyName("price")]
    public decimal Price { get; set; }

    [JsonPropertyName("stock")]
    public int Stock { get; set; }

    [JsonPropertyName("externalId")]
    public string ExternalId { get; set; } = string.Empty;
}

public sealed record OneCImportResult(
    int ImportedCount,
    int UpdatedCount,
    int CreatedCount,
    int FailedCount);
