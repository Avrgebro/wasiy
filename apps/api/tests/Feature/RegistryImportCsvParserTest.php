<?php

use App\Enums\ImportRowStatus;
use App\Enums\RegistryStatus;
use App\Enums\ResidentType;
use App\Models\Location;
use App\Models\Resident;
use App\Models\Unit;
use App\Models\UnitMembership;
use App\Services\RegistryImports\Exceptions\RegistryCsvParseException;
use App\Services\RegistryImports\RegistryCsvParser;
use App\Services\RegistryImports\RegistryImportDuplicateDetector;
use App\Services\RegistryImports\RegistryImportValidator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

function parseRegistryCsv(string $csv): array
{
    return app(RegistryCsvParser::class)->parse($csv);
}

function validateRegistryCsvRows(array $rows): array
{
    return app(RegistryImportValidator::class)->validate($rows);
}

function detectRegistryCsvDuplicates(Location $location, array $previews): array
{
    return app(RegistryImportDuplicateDetector::class)->detect($location, $previews);
}

test('parser accepts canonical spanish headings and normalizes row values', function () {
    $rows = parseRegistryCsv(implode("\n", [
        'unidad,edificio,piso,nombres,apellidos,telefono,email,tipo_residente,contacto_principal,estado_membresia,notas_unidad',
        ' 301 , Torre A , 3 , Ana , Salas , , ana@example.test , propietario , si , activo , ',
    ]));

    expect($rows)->toHaveCount(1)
        ->and($rows[0]->rowNumber)->toBe(2)
        ->and($rows[0]->rawData['unidad'])->toBe(' 301 ')
        ->and($rows[0]->normalizedData)->toMatchArray([
            'unit_number' => '301',
            'building_name' => 'Torre A',
            'floor' => '3',
            'first_name' => 'Ana',
            'last_name' => 'Salas',
            'phone' => null,
            'email' => 'ana@example.test',
            'resident_type' => 'propietario',
            'is_primary_contact' => 'si',
            'membership_status' => 'activo',
            'unit_notes' => null,
        ]);
});

test('parser handles utf8 bom and semicolon delimiters', function () {
    $rows = parseRegistryCsv("\xEF\xBB\xBFunidad;edificio;piso\n401;Torre B;4\n");

    expect($rows)->toHaveCount(1)
        ->and($rows[0]->normalizedData)->toMatchArray([
            'unit_number' => '401',
            'building_name' => 'Torre B',
            'floor' => '4',
        ]);
});

test('parser rejects csv files over the configured row limit', function () {
    config(['wasiy.imports.max_rows' => 1]);

    expect(fn () => parseRegistryCsv("unidad\n301\n302\n"))
        ->toThrow(RegistryCsvParseException::class, 'El CSV supera el maximo permitido de 1 filas.');
});

test('parser rejects unknown and missing required headings', function () {
    expect(fn () => parseRegistryCsv("unidad,columna_extra\n301,valor\n"))
        ->toThrow(RegistryCsvParseException::class, 'Encabezado no reconocido: columna_extra.');

    expect(fn () => parseRegistryCsv("edificio,piso\nTorre A,3\n"))
        ->toThrow(RegistryCsvParseException::class, 'Falta el encabezado requerido: unidad.');
});

test('validator accepts unit only rows and normalizes resident aliases', function () {
    $location = Location::factory()->create();
    $rows = parseRegistryCsv(implode("\n", [
        'unidad,edificio,piso,nombres,apellidos,email,tipo_residente,contacto_principal,estado_membresia',
        '301,Torre A,3,,,,,,',
        '302,Torre A,3,Ana,Salas,ana@example.test,propietario,si,activo',
    ]));

    $previews = validateRegistryCsvRows($rows);

    expect($previews[0]->status)->toBe(ImportRowStatus::Valid)
        ->and($previews[0]->errors)->toBe([])
        ->and($previews[0]->normalizedData->toArray())->toMatchArray([
            'unit_number' => '301',
            'building_name' => 'Torre A',
            'resident_type' => null,
            'membership_status' => RegistryStatus::Active->value,
            'is_primary_contact' => false,
        ])
        ->and($previews[1]->status)->toBe(ImportRowStatus::Valid)
        ->and($previews[1]->normalizedData->toArray())->toMatchArray([
            'resident_type' => ResidentType::Owner->value,
            'membership_status' => RegistryStatus::Active->value,
            'is_primary_contact' => true,
        ]);
});

test('validator returns spanish row errors for invalid resident rows', function () {
    $location = Location::factory()->create();
    $longName = str_repeat('A', 256);
    $rows = parseRegistryCsv(implode("\n", [
        'unidad,nombres,apellidos,email,tipo_residente,estado_membresia',
        "301,{$longName},,correo-invalido,desconocido,pausado",
    ]));

    $previews = validateRegistryCsvRows($rows);

    expect($previews[0]->status)->toBe(ImportRowStatus::Error)
        ->and($previews[0]->errors)->toContain('El campo nombres no puede superar 255 caracteres.')
        ->and($previews[0]->errors)->toContain('El campo apellidos es obligatorio para filas de residente.')
        ->and($previews[0]->errors)->toContain('El correo electronico no tiene un formato valido.')
        ->and($previews[0]->errors)->toContain('El tipo de residente no es valido.')
        ->and($previews[0]->errors)->toContain('El estado de membresia no es valido.');
});

test('validator rejects more than one imported primary contact for the same unit', function () {
    $location = Location::factory()->create();
    $rows = parseRegistryCsv(implode("\n", [
        'unidad,nombres,apellidos,tipo_residente,contacto_principal',
        '301,Ana,Salas,owner,si',
        '301,Luis,Rojas,tenant,si',
    ]));

    $previews = validateRegistryCsvRows($rows);

    expect($previews[0]->status)->toBe(ImportRowStatus::Error)
        ->and($previews[1]->status)->toBe(ImportRowStatus::Error)
        ->and($previews[0]->errors)->toContain('Solo puede haber un contacto principal importado por unidad.')
        ->and($previews[1]->errors)->toContain('Solo puede haber un contacto principal importado por unidad.');
});

test('duplicate detector distinguishes reusable units and skipped duplicates', function () {
    $location = Location::factory()->create();
    $unit = Unit::factory()
        ->for($location->account)
        ->for($location)
        ->create([
            'unit_number' => '301',
            'building_name' => 'Torre A',
        ]);
    $resident = Resident::factory()
        ->for($location->account)
        ->create([
            'email' => 'ana@example.test',
        ]);
    UnitMembership::factory()
        ->for($location->account)
        ->for($location)
        ->for($unit)
        ->for($resident)
        ->create();

    $rows = parseRegistryCsv(implode("\n", [
        'unidad,edificio,nombres,apellidos,email,tipo_residente',
        '301,Torre A,Ana,Salas,ana@example.test,owner',
        '301,Torre A,,,',
        '301,Torre A,,,',
    ]));

    $previews = detectRegistryCsvDuplicates($location, validateRegistryCsvRows($rows));

    expect($previews[0]->status)->toBe(ImportRowStatus::Duplicate)
        ->and($previews[0]->duplicateKey)->toBe("membership:{$unit->id}:{$resident->id}")
        ->and($previews[0]->warnings)->toContain('La unidad existente sera reutilizada.')
        ->and($previews[0]->warnings)->toContain('El residente existente sera reutilizado.')
        ->and($previews[1]->status)->toBe(ImportRowStatus::Warning)
        ->and($previews[1]->warnings)->toContain('La unidad existente sera reutilizada.')
        ->and($previews[2]->status)->toBe(ImportRowStatus::Duplicate)
        ->and($previews[2]->duplicateKey)->toBe('unit-row:torre a:301');
});

test('multiple resident rows for one unit are not treated as duplicate unit rows', function () {
    $location = Location::factory()->create();
    $rows = parseRegistryCsv(implode("\n", [
        'unidad,edificio,nombres,apellidos,email,tipo_residente',
        '501,Torre C,Ana,Salas,ana@example.test,owner',
        '501,Torre C,Luis,Rojas,luis@example.test,tenant',
    ]));

    $previews = detectRegistryCsvDuplicates($location, validateRegistryCsvRows($rows));

    expect($previews[0]->status)->toBe(ImportRowStatus::Valid)
        ->and($previews[1]->status)->toBe(ImportRowStatus::Valid)
        ->and($previews[0]->duplicateKey)->toBeNull()
        ->and($previews[1]->duplicateKey)->toBeNull();
});

test('duplicate detector runs a bounded number of queries regardless of row count', function () {
    $location = Location::factory()->create();
    Unit::factory()->for($location->account)->for($location)->create([
        'unit_number' => '101',
        'building_name' => 'Torre A',
    ]);
    Resident::factory()->for($location->account)->create(['email' => 'ana@example.test']);

    $csv = implode("\n", [
        'unidad,edificio,nombres,apellidos,email,tipo_residente',
        '101,Torre A,Ana,Salas,ana@example.test,propietario',
        '102,Torre A,Luis,Rojas,luis@example.test,inquilino',
        '103,Torre B,Rosa,Diaz,rosa@example.test,propietario',
        '104,Torre B,,,,',
        '105,Torre C,Juan,Vega,juan@example.test,inquilino',
    ]);
    $previews = validateRegistryCsvRows(parseRegistryCsv($csv));

    DB::flushQueryLog();
    DB::enableQueryLog();
    detectRegistryCsvDuplicates($location, $previews);
    $queryCount = count(DB::getQueryLog());
    DB::disableQueryLog();

    // One batched query each for units, residents, and memberships —
    // never per-row.
    expect($queryCount)->toBeLessThanOrEqual(3);
});

test('unit only rows fail loudly on invalid membership status or primary contact values', function () {
    $rows = parseRegistryCsv(implode("\n", [
        'unidad,estado_membresia,contacto_principal',
        '301,pausado,quizas',
    ]));

    $previews = validateRegistryCsvRows($rows);

    expect($previews[0]->status)->toBe(ImportRowStatus::Error)
        ->and($previews[0]->errors)->toContain('El estado de membresia no es valido.')
        ->and($previews[0]->errors)->toContain('El valor de contacto principal no es valido.');
});

test('a primary contact with an inactive membership is rejected', function () {
    $rows = parseRegistryCsv(implode("\n", [
        'unidad,nombres,apellidos,tipo_residente,estado_membresia,contacto_principal',
        '301,Ana,Salas,propietario,inactivo,si',
    ]));

    $previews = validateRegistryCsvRows($rows);

    expect($previews[0]->status)->toBe(ImportRowStatus::Error)
        ->and($previews[0]->errors)->toContain('El contacto principal no puede tener una membresia inactiva.');
});
