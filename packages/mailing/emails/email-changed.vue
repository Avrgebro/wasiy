<template>
  <!--
    Heads-up to the PREVIOUS address once a user's login email changed
    (mockup 21). Rendered by App\Notifications\EmailChangedNotification.
    Blade data: $firstName, $previousEmail, $newEmail, $contactEmail
  -->
  <WasiyLayout>
    <Preheader>Tu correo de acceso a Wasiy ahora es {{ blade('$newEmail') }}.</Preheader>

    <Container class="max-w-xl p-0 py-10 sm:py-0">
      <Section class="rounded-t-lg bg-teal px-6 pt-6 pb-11 sm:rounded-none">
        <!-- Inline, not Row/Column: those stack on phones and would put the
             wordmark under the mark. -->
        <a :href="bladeConfig('wasiy.marketing.url')" class="inline-block no-underline">
          <Img :src="assetUrl('images/mail/mark-cream.png')" width="28" height="28" alt="Wasiy" class="inline-block align-middle" />
          <span class="ml-2 inline-block align-middle font-sora text-[21px] font-semibold tracking-tight text-bg">wasiy</span>
        </a>

        <Spacer class="h-16 sm:h-10" />

        <Text class="m-0 mb-3 text-[12.5px] font-semibold uppercase tracking-[0.1em] text-teal-pale">
          Mi cuenta
        </Text>

        <Heading class="font-sora text-[30px]/9 font-bold tracking-tight text-bg">
          Tu correo de acceso cambió
        </Heading>
      </Section>

      <Section class="rounded-b-lg bg-white px-6 py-12 sm:rounded-none">
        <Text class="m-0 text-base text-ink">Hola {{ blade('$firstName') }},</Text>

        <Text class="mt-4 text-base text-muted">
          El correo con el que entras a Wasiy cambió. Desde ahora los avisos y el inicio de sesión usan la nueva dirección.
        </Text>

        <Spacer class="h-6" />

        <Section class="rounded-xl bg-cream px-6 py-5">
          <Row>
            <Column class="w-1/3"><Text class="m-0 text-sm text-muted">Antes</Text></Column>
            <Column class="w-2/3 text-right"><Text class="m-0 text-base font-semibold text-ink">{{ blade('$previousEmail') }}</Text></Column>
          </Row>
          <Row class="mt-3">
            <Column class="w-1/3"><Text class="m-0 text-sm text-muted">Ahora</Text></Column>
            <Column class="w-2/3 text-right"><Text class="m-0 text-base font-semibold text-ink">{{ blade('$newEmail') }}</Text></Column>
          </Row>
        </Section>

        <Hr class="my-6 bg-border" />

        <Text class="m-0 text-[13px] text-faint">
          Si no fuiste tú, escríbenos de inmediato a <a :href="'mailto:' + blade('$contactEmail')" class="text-teal no-underline">{{ blade('$contactEmail') }}</a> desde este correo para recuperar tu acceso.
        </Text>
      </Section>

      <WasiyFooter />
    </Container>
  </WasiyLayout>
</template>
