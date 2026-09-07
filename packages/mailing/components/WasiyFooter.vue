<template>
  <!--
    Shared footer: mark, wordmark, tagline and contact line. The tagline
    echoes the login headline ("Todo lo que pasa en tu comunidad, en un solo
    lugar.") so email and app speak with one voice; keep them in sync.
  -->
  <Section class="px-6 py-11">
    <a :href="bladeConfig('wasiy.marketing.url')" class="inline-block no-underline">
      <Img :src="assetUrl('images/mail/mark-teal.png')" width="20" height="20" alt="" class="inline-block align-middle" />
      <span class="ml-2 inline-block align-middle font-sora text-[15px] font-semibold text-ink">wasiy</span>
    </a>

    <Text class="m-0 mt-2 text-[12.5px] text-muted">Todo lo que pasa en tu edificio, en un solo lugar.</Text>

    <Text class="m-0 mt-4 text-[13px] text-faint">
      <a :href="bladeConfig('wasiy.marketing.url')" class="text-teal no-underline">wasiy.co</a>
      &nbsp;·&nbsp;
      <a href="mailto:hola@wasiy.co" class="text-teal no-underline">hola@wasiy.co</a>
      &nbsp;·&nbsp;
      &copy; {{ new Date().getFullYear() }} Wasiy
    </Text>
  </Section>
</template>
