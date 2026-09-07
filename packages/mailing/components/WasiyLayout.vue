<template>
  <!--
    Brand shell every Wasiy email starts from. Wraps Maizzle's Layout with
    Spanish as the document language, the cream page background and the
    marketing site's type stack. Brand colour tokens come from tailwind.css
    via the afterRender hook in maizzle.config.ts.
  -->
  <Layout lang="es" body-class="bg-bg" class="bg-bg font-instrument">
    <Font family="Sora" :weights="[600, 700]" fallback="'Segoe UI', Helvetica, Arial, sans-serif" />
    <Font family="Instrument Sans" :weights="[400, 500, 600]" fallback="'Segoe UI', Helvetica, Arial, sans-serif" />
    <slot />
  </Layout>
</template>
