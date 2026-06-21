<?php

namespace App\Services\RegistryImports;

use App\Data\RegistryImports\ParsedRegistryImportRow;
use App\Services\RegistryImports\Exceptions\RegistryCsvParseException;
use Illuminate\Support\Str;

class RegistryCsvParser
{
    /**
     * @var array<string, string>
     */
    private const HEADER_MAP = [
        'unidad' => 'unit_number',
        'numero_unidad' => 'unit_number',
        'edificio' => 'building_name',
        'piso' => 'floor',
        'nombres' => 'first_name',
        'nombre' => 'first_name',
        'apellidos' => 'last_name',
        'apellido' => 'last_name',
        'telefono' => 'phone',
        'email' => 'email',
        'correo' => 'email',
        'correo_electronico' => 'email',
        'tipo_residente' => 'resident_type',
        'contacto_principal' => 'is_primary_contact',
        'estado_membresia' => 'membership_status',
        'notas_unidad' => 'unit_notes',
    ];

    /**
     * @return array<int, ParsedRegistryImportRow>
     */
    public function parse(string $contents): array
    {
        $handle = fopen('php://temp', 'r+');

        fwrite($handle, $contents);
        rewind($handle);

        $headerLine = fgets($handle);

        if ($headerLine === false) {
            fclose($handle);

            throw new RegistryCsvParseException(['El CSV no contiene encabezados.']);
        }

        $delimiter = $this->detectDelimiter($headerLine);
        $headers = str_getcsv($this->stripBom($headerLine), $delimiter);
        $mappedHeaders = $this->mapHeaders($headers);
        $rows = [];
        $rowNumber = 1;

        while (($cells = fgetcsv($handle, separator: $delimiter)) !== false) {
            $rowNumber++;

            if ($this->isEmptyRow($cells)) {
                continue;
            }

            $rawData = [];
            $normalizedData = $this->emptyNormalizedRow();

            foreach ($mappedHeaders as $index => $mappedHeader) {
                $rawValue = $cells[$index] ?? null;
                $rawData[$mappedHeader['source']] = $rawValue;
                $normalizedData[$mappedHeader['target']] = $this->normalizeCell($rawValue);
            }

            $rows[] = new ParsedRegistryImportRow(
                rowNumber: $rowNumber,
                rawData: $rawData,
                normalizedData: $normalizedData,
            );

            $maxRows = (int) config('wasiy.imports.max_rows', 5000);

            if (count($rows) > $maxRows) {
                fclose($handle);

                throw new RegistryCsvParseException(["El CSV supera el maximo permitido de {$maxRows} filas."]);
            }
        }

        fclose($handle);

        return $rows;
    }

    private function detectDelimiter(string $headerLine): string
    {
        $commaCount = count(str_getcsv($headerLine, ','));
        $semicolonCount = count(str_getcsv($headerLine, ';'));

        return $semicolonCount > $commaCount ? ';' : ',';
    }

    private function stripBom(string $value): string
    {
        return preg_replace('/^\xEF\xBB\xBF/', '', $value) ?? $value;
    }

    /**
     * @param  array<int, string|null>  $headers
     * @return array<int, array{source: string, target: string}>
     */
    private function mapHeaders(array $headers): array
    {
        $mapped = [];
        $targets = [];
        $hasUnit = false;

        foreach ($headers as $header) {
            $source = $this->normalizeHeader((string) $header);
            $target = self::HEADER_MAP[$source] ?? null;

            if ($target === null) {
                throw new RegistryCsvParseException(["Encabezado no reconocido: {$source}."]);
            }

            if (in_array($target, $targets, true)) {
                throw new RegistryCsvParseException(["Encabezado duplicado para: {$source}."]);
            }

            $hasUnit = $hasUnit || $target === 'unit_number';
            $targets[] = $target;
            $mapped[] = [
                'source' => $source,
                'target' => $target,
            ];
        }

        if (! $hasUnit) {
            throw new RegistryCsvParseException(['Falta el encabezado requerido: unidad.']);
        }

        return $mapped;
    }

    private function normalizeHeader(string $header): string
    {
        $normalized = Str::of($this->stripBom($header))
            ->ascii()
            ->lower()
            ->replaceMatches('/[^a-z0-9]+/', '_')
            ->trim('_')
            ->toString();

        return $normalized;
    }

    /**
     * @param  array<int, string|null>  $cells
     */
    private function isEmptyRow(array $cells): bool
    {
        foreach ($cells as $cell) {
            if ($this->normalizeCell($cell) !== null) {
                return false;
            }
        }

        return true;
    }

    private function normalizeCell(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $trimmed = trim($value);

        return $trimmed === '' ? null : $trimmed;
    }

    /**
     * @return array<string, mixed>
     */
    private function emptyNormalizedRow(): array
    {
        return [
            'unit_number' => null,
            'building_name' => null,
            'floor' => null,
            'first_name' => null,
            'last_name' => null,
            'phone' => null,
            'email' => null,
            'resident_type' => null,
            'is_primary_contact' => null,
            'membership_status' => null,
            'unit_notes' => null,
        ];
    }
}
