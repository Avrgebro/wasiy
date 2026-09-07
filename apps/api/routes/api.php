<?php

use App\Http\Controllers\Api\AccessContextController;
use App\Http\Controllers\Api\AccountSettingsController;
use App\Http\Controllers\Api\AccountStaffController;
use App\Http\Controllers\Api\AmenityController;
use App\Http\Controllers\Api\AmenityPhotoController;
use App\Http\Controllers\Api\AnnouncementController;
use App\Http\Controllers\Api\BuildingController;
use App\Http\Controllers\Api\FinancialMovementController;
use App\Http\Controllers\Api\LocationController;
use App\Http\Controllers\Api\LocationDashboardController;
use App\Http\Controllers\Api\LocationPhotoController;
use App\Http\Controllers\Api\LocationSearchController;
use App\Http\Controllers\Api\LocationSettingsController;
use App\Http\Controllers\Api\MeController;
use App\Http\Controllers\Api\PackageController;
use App\Http\Controllers\Api\PasswordController;
use App\Http\Controllers\Api\PhotoController;
use App\Http\Controllers\Api\PortalAlertController;
use App\Http\Controllers\Api\PortalAmenityController;
use App\Http\Controllers\Api\PortalHouseholdController;
use App\Http\Controllers\Api\PortalLedgerController;
use App\Http\Controllers\Api\PortalPackageController;
use App\Http\Controllers\Api\PortalReservationController;
use App\Http\Controllers\Api\PortalResidentController;
use App\Http\Controllers\Api\PortalVehicleController;
use App\Http\Controllers\Api\PortalVisitController;
use App\Http\Controllers\Api\ReservationController;
use App\Http\Controllers\Api\ResidentController;
use App\Http\Controllers\Api\ResidentInvitationController;
use App\Http\Controllers\Api\StaffInvitationController;
use App\Http\Controllers\Api\UnitController;
use App\Http\Controllers\Api\UnitMembershipController;
use App\Http\Controllers\Api\VehicleController;
use App\Http\Controllers\Api\VisitController;
use App\Http\Controllers\LeadController;
use App\Http\Controllers\RegistrationController;
use App\Http\Middleware\EnsureUserIsActive;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Guest invitation flows
|--------------------------------------------------------------------------
| The emailed token is the credential.
*/

Route::get('/public/plans', [RegistrationController::class, 'plans']);
// Marketing forms; the 'leads' limiter (AppServiceProvider) throttles by IP.
Route::post('/public/leads', [LeadController::class, 'store'])->middleware('throttle:leads');

Route::controller(ResidentInvitationController::class)->group(function () {
    Route::get('/resident-invitations/{token}', 'show');
    Route::post('/resident-invitations/{token}/claim', 'claim');
});

Route::controller(StaffInvitationController::class)->group(function () {
    Route::get('/staff-invitations/{token}', 'show');
    Route::post('/staff-invitations/{token}/accept', 'accept');
});

Route::middleware(['auth:sanctum', EnsureUserIsActive::class])->group(function () {
    /*
    |----------------------------------------------------------------------
    | Session and access context
    |----------------------------------------------------------------------
    */

    Route::get('/me', MeController::class);
    Route::patch('/me/password', [PasswordController::class, 'update']);

    Route::controller(AccessContextController::class)->group(function () {
        Route::post('/context/account', 'selectAccount');
        Route::post('/context/location', 'selectLocation');
        Route::delete('/context', 'clear');
    });

    /*
    |----------------------------------------------------------------------
    | Account
    |----------------------------------------------------------------------
    | Staff management is Account Admins only, enforced once on the group.
    */

    Route::prefix('accounts/{account}')->group(function () {
        Route::middleware('can:manageStaff,account')->group(function () {
            Route::controller(AccountStaffController::class)->group(function () {
                Route::get('/staff', 'index');
                Route::patch('/staff/{user}/access', 'updateAccess');
                Route::post('/staff/{user}/deactivate', 'deactivate');
                Route::post('/staff/{user}/reactivate', 'reactivate');
            });

            Route::controller(StaffInvitationController::class)->group(function () {
                Route::get('/staff/invitations', 'index');
                Route::post('/staff/invitations', 'store');
                Route::delete('/staff/invitations/{invitation}', 'destroy');
                Route::post('/staff/invitations/{invitation}/resend', 'resend');
            });
        });

        Route::controller(AccountSettingsController::class)->group(function () {
            Route::get('/settings', 'show');
            Route::put('/settings', 'update');
        });
    });

    /*
    |----------------------------------------------------------------------
    | Account-scoped location tree
    |----------------------------------------------------------------------
    | Cross-account probes 404 in the controllers, role-level rules live in
    | LocationPolicy / AccountPolicy. Scoped bindings resolve {location}
    | inside {account}, so a Location reached through the wrong Account
    | 404s before any policy runs.
    */

    Route::scopeBindings()->prefix('accounts/{account}')->group(function () {
        // Locations
        Route::controller(LocationController::class)->group(function () {
            Route::get('/locations', 'index');
            Route::post('/locations', 'store');
            Route::get('/locations/{location}', 'show');
            Route::patch('/locations/{location}', 'update');
            Route::post('/locations/{location}/deactivate', 'deactivate');
            Route::post('/locations/{location}/reactivate', 'reactivate');
        });

        Route::prefix('locations/{location}')->group(function () {
            // Location settings
            Route::controller(LocationSettingsController::class)->group(function () {
                Route::get('/settings', 'show');
                Route::put('/settings', 'update');
            });

            // Location photos
            Route::controller(LocationPhotoController::class)->group(function () {
                Route::post('/photos', 'store');
                Route::put('/photos/order', 'reorder');
                Route::delete('/photos/{photo}', 'destroy');
                Route::post('/photos/{photo}/cover', 'cover');
            });

            // Amenities
            Route::controller(AmenityController::class)->group(function () {
                Route::get('/amenities', 'index');
                Route::post('/amenities', 'store');
                Route::get('/amenities/{amenity}', 'show');
                Route::patch('/amenities/{amenity}', 'update');
                Route::post('/amenities/{amenity}/deactivate', 'deactivate');
                Route::post('/amenities/{amenity}/reactivate', 'reactivate');
            });

            // Amenity photos
            Route::controller(AmenityPhotoController::class)->group(function () {
                Route::post('/amenities/{amenity}/photos', 'store');
                Route::put('/amenities/{amenity}/photos/order', 'reorder');
                Route::delete('/amenities/{amenity}/photos/{photo}', 'destroy');
                Route::post('/amenities/{amenity}/photos/{photo}/cover', 'cover');
            });

            // Reservations (collection)
            Route::controller(ReservationController::class)->group(function () {
                Route::get('/reservations', 'index');
                Route::post('/reservations', 'store');
            });

            // Finances (collection)
            Route::controller(FinancialMovementController::class)->group(function () {
                Route::get('/finances/movements', 'index');
                Route::post('/finances/movements', 'store');
                Route::get('/finances/summary', 'summary');
                Route::post('/finances/dues', 'generateDues');
            });
        });

        // Reservations (member)
        Route::controller(ReservationController::class)->group(function () {
            Route::get('/reservations/{reservation}', 'show');
            Route::post('/reservations/{reservation}/approve', 'approve');
            Route::post('/reservations/{reservation}/reject', 'reject');
            Route::post('/reservations/{reservation}/observe', 'observe');
            Route::post('/reservations/{reservation}/cancel', 'cancel');
        });

        // Finances (member)
        Route::controller(FinancialMovementController::class)->group(function () {
            Route::get('/finances/movements/{financialMovement}', 'show');
            Route::post('/finances/movements/{financialMovement}/status', 'transition');
        });
    });

    // Photo bytes: authorization delegates to the owner's view policy.
    Route::get('/photos/{photo}', [PhotoController::class, 'show']);

    /*
    |----------------------------------------------------------------------
    | Location-scoped operations
    |----------------------------------------------------------------------
    | Staff surface. Fine-grained authorization lives in the controllers'
    | gates and FormRequests. Each block reads collection → member →
    | actions → sub-resources.
    */

    // Dashboard and search
    Route::get('/locations/{location}/dashboard', LocationDashboardController::class)
        ->can('view', 'location');
    Route::get('/locations/{location}/search', LocationSearchController::class);

    // Buildings
    Route::controller(BuildingController::class)->group(function () {
        Route::get('/locations/{location}/buildings', 'index');
        Route::post('/locations/{location}/buildings', 'store');
        Route::patch('/buildings/{building}', 'update');
        Route::delete('/buildings/{building}', 'destroy');
    });

    // Units
    Route::controller(UnitController::class)->group(function () {
        Route::get('/locations/{location}/units', 'index');
        Route::post('/locations/{location}/units', 'store');
        Route::get('/units/{unit}', 'show');
        Route::patch('/units/{unit}', 'update');
        Route::delete('/units/{unit}', 'destroy');
        Route::post('/units/{unit}/deactivate', 'deactivate');
        Route::post('/units/{unit}/reactivate', 'reactivate');
        Route::post('/units/{unit}/notes', 'storeNote');
    });

    // Vehicles
    Route::controller(VehicleController::class)->group(function () {
        Route::get('/locations/{location}/vehicles', 'index');
        Route::post('/locations/{location}/vehicles', 'store');
        Route::get('/vehicles/{vehicle}', 'show');
        Route::patch('/vehicles/{vehicle}', 'update');
        Route::delete('/vehicles/{vehicle}', 'destroy');
    });

    // Residents
    Route::controller(ResidentController::class)->group(function () {
        Route::get('/accounts/{account}/residents', 'index');
        Route::post('/accounts/{account}/residents', 'store');
        Route::get('/residents/{resident}', 'show');
        Route::patch('/residents/{resident}', 'update');
        Route::delete('/residents/{resident}', 'destroy');
        Route::post('/residents/{resident}/deactivate', 'deactivate');
        Route::post('/residents/{resident}/reactivate', 'reactivate');
    });

    Route::controller(ResidentInvitationController::class)->group(function () {
        Route::post('/residents/{resident}/invitations', 'store');
        Route::delete('/residents/{resident}/invitations/{invitation}', 'destroy');
        Route::post('/residents/{resident}/invitations/{invitation}/resend', 'resend');
    });

    Route::controller(UnitMembershipController::class)->group(function () {
        Route::post('/residents/{resident}/memberships', 'store');
        Route::patch('/unit-memberships/{membership}', 'update');
        Route::delete('/unit-memberships/{membership}', 'destroy');
    });

    // Packages
    Route::controller(PackageController::class)->group(function () {
        Route::get('/locations/{location}/packages', 'index');
        Route::post('/locations/{location}/packages', 'store');
        Route::post('/packages/{package}/deliver', 'deliver');
    });

    // Visits
    Route::controller(VisitController::class)->group(function () {
        Route::get('/locations/{location}/visits', 'index');
        Route::post('/locations/{location}/visits', 'store');
        Route::post('/visits/{visit}/check-out', 'checkOut');
        Route::post('/visits/{visit}/confirm-arrival', 'confirmArrival');
    });

    // Announcements
    Route::controller(AnnouncementController::class)->group(function () {
        Route::get('/locations/{location}/announcements', 'index');
        Route::post('/locations/{location}/announcements', 'store');
        Route::get('/announcements/{announcement}', 'show');
        Route::patch('/announcements/{announcement}', 'update');
        Route::post('/announcements/{announcement}/archive', 'archive');
    });

    /*
    |----------------------------------------------------------------------
    | Resident portal
    |----------------------------------------------------------------------
    | Gated by resident-membership policies, never staff roles.
    */

    Route::prefix('portal')->group(function () {
        Route::controller(PortalResidentController::class)->group(function () {
            Route::get('/resident', 'show');
            Route::patch('/resident/phone', 'updatePhone');
            Route::patch('/resident/email-alerts', 'updateEmailAlerts');
        });

        Route::controller(PortalHouseholdController::class)->group(function () {
            Route::get('/household', 'index');
            Route::post('/household', 'store');
            Route::delete('/household/{membership}', 'destroy');
            Route::post('/household/{membership}/resend-invitation', 'resendInvitation');
        });

        Route::get('/ledger', [PortalLedgerController::class, 'index']);

        Route::controller(PortalAlertController::class)->group(function () {
            Route::get('/alerts', 'index');
            Route::get('/alerts/unread-count', 'unreadCount');
            Route::post('/alerts/read-all', 'markAllRead');
            Route::post('/alerts/{alert}/read', 'markRead');
        });

        Route::controller(PortalAmenityController::class)->group(function () {
            Route::get('/amenities', 'index');
            Route::get('/amenities/{amenity}/availability', 'availability');
        });

        Route::controller(PortalReservationController::class)->group(function () {
            Route::get('/reservations', 'index');
            Route::post('/reservations', 'store');
            Route::get('/reservations/{reservation}', 'show');
            Route::post('/reservations/{reservation}/cancel', 'cancel');
        });

        Route::get('/packages', [PortalPackageController::class, 'index']);

        Route::controller(PortalVisitController::class)->group(function () {
            Route::get('/visits', 'index');
            Route::post('/visits', 'store');
            Route::post('/visits/{visit}/cancel', 'cancel');
        });

        Route::controller(PortalVehicleController::class)->group(function () {
            Route::get('/vehicles', 'index');
            Route::post('/vehicles', 'store');
            Route::patch('/vehicles/{vehicle}', 'update');
            Route::delete('/vehicles/{vehicle}', 'destroy');
        });
    });
});
