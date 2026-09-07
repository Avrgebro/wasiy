<template>
  <!--
    OTP for the self-serve registration flow (/registro). Rendered by
    App\Notifications\RegistrationCodeNotification.
    Blade data: $code (6 digits), $minutes (code lifetime)
  -->
  <WasiyLayout>
    <Preheader>Tu código de verificación es {{ blade('$code') }}. Vence en {{ blade('$minutes') }} minutos.</Preheader>

    <Container class="max-w-xl p-0 py-10 sm:p-6">
      <Section class="rounded-t-lg bg-teal px-6 pt-6 pb-11">
        <Row>
          <Column class="w-auto pr-2 align-middle">
            <a :href="bladeConfig('wasiy.marketing.url')" class="no-underline">
              <Img :src="assetUrl('images/mail/mark-cream.png')" width="28" height="28" alt="Wasiy" />
            </a>
          </Column>
          <Column class="align-middle">
            <a :href="bladeConfig('wasiy.marketing.url')" class="font-sora text-[21px] font-semibold tracking-tight text-bg no-underline">wasiy</a>
          </Column>
        </Row>

        <Spacer class="h-16" />

        <Text class="m-0 mb-3 text-[12.5px] font-semibold uppercase tracking-[0.1em] text-teal-pale">
          Registro
        </Text>

        <Heading class="font-sora text-[30px]/9 font-bold tracking-tight text-bg">
          Confirma tu correo
        </Heading>
      </Section>

      <Section class="rounded-b-lg bg-white px-6 py-12">
        <Text class="m-0 text-base text-ink">Hola,</Text>

        <Text class="mt-4 text-base text-muted">
          Ingresa este código en la página de registro para continuar con la creación de tu cuenta.
        </Text>

        <Spacer class="h-6" />

        <Section class="rounded-xl bg-cream px-6 py-6 text-center">
          <Text class="m-0 font-sora text-[36px]/10 font-bold tracking-[0.2em] text-teal">
            {{ blade('$code') }}
          </Text>
        </Section>

        <Text class="mt-6 text-sm text-muted">
          Vence en <Text as="span" class="font-semibold text-ink">{{ blade('$minutes') }} minutos</Text>.
          No compartas este código con nadie; el equipo de Wasiy nunca te lo pedirá.
        </Text>

        <Hr class="my-6 bg-border" />

        <Text class="m-0 text-[13px] text-faint">
          Si no solicitaste este registro, puedes ignorar este correo. Tu cuenta no se creará sin el código.
        </Text>
      </Section>

      <Section class="px-6 py-11">
        <Row>
          <Column class="w-auto pr-2 align-middle">
            <a :href="bladeConfig('wasiy.marketing.url')" class="no-underline">
              <Img :src="assetUrl('images/mail/mark-teal.png')" width="20" height="20" alt="" />
            </a>
          </Column>
          <Column class="align-middle">
            <a :href="bladeConfig('wasiy.marketing.url')" class="font-sora text-[15px] font-semibold text-ink no-underline">wasiy</a>
          </Column>
        </Row>

        <Text class="m-0 mt-2 text-[12.5px] text-muted">Hecho para edificios en Perú.</Text>

        <Text class="m-0 mt-4 text-[13px] text-faint">
          <a :href="bladeConfig('wasiy.marketing.url')" class="text-teal no-underline">wasiy.co</a>
          &nbsp;·&nbsp;
          <a href="mailto:hola@wasiy.co" class="text-teal no-underline">hola@wasiy.co</a>
          &nbsp;·&nbsp;
          &copy; {{ new Date().getFullYear() }} Wasiy
        </Text>
      </Section>
    </Container>
  </WasiyLayout>
</template>
