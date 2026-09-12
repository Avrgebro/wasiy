# API Messages in Spanish

The API answers in Spanish. `APP_LOCALE=es`, with `en` as the fallback. Framework strings come from Laravel-Lang; ours live in `lang/es.json`, keyed by the English sentence the code passes to the translation helper.

## Context

Both web surfaces have been Spanish through i18next since the start, but the API ran on Laravel's default English locale with no other language folder. Every validation error the API produced, "The name field is required.", reached the form field and the error toast in English inside an otherwise Spanish product. Sixty-five rule messages written in the code as English translation keys did the same. Activity summaries and emails were already Spanish by hand and are unaffected.

## Decisions

- `laravel-lang/common` supplies `lang/es/*.php` and the framework part of `lang/es.json`, refreshed with `php artisan lang:update` on upgrades. It also supplies attribute names, so messages read "El campo nombre es obligatorio."
- Our own messages stay English in the code and are translated in `lang/es.json`. A new message is added there in the same change that introduces it. Field names specific to Wasiy sit at the top of the `attributes` array in `lang/es/validation.php`.
- The test suite pins `APP_LOCALE=en` in `phpunit.xml`, so the hundreds of assertions on message text stay stable. `SpanishMessagesTest` covers the Spanish path for one framework rule and one custom rule.
- No per-user locale yet. Accounts are Peruvian; a locale on the user is a later addition and would only change `setLocale`.

## Consequences

Validation errors and rule messages arrive translated with no client change. A message added in code without its Spanish line falls back to the English key, which the Spanish test file does not catch on its own, so reviews look for the pair.
