<template>
  <!--
    Invitation to join a condominium's staff team in the admin app.
    Rendered by App\Notifications\StaffInvitationNotification.
    Blade data: $firstName, $accountName, $invitedByName?, $roleLabel,
    $locations (array of location names; empty for a superadmin),
    $claimUrl, $expiresOn (human date, e.g. "21 de setiembre")
  -->
  <WasiyLayout>
    <Preheader>{{ blade('$accountName') }} te invitó a su equipo en Wasiy. El enlace vence el {{ blade('$expiresOn') }}.</Preheader>

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
          {{ blade('$accountName') }}
        </Text>

        <Heading class="font-sora text-[30px]/9 font-bold tracking-tight text-bg">
          Te invitaron al equipo
        </Heading>
      </Section>

      <Section class="rounded-b-lg bg-white px-6 py-12 sm:rounded-none">
        <Text class="m-0 text-base text-ink">Hola {{ blade('$firstName') }},</Text>

        <Raw>@if (!empty($invitedByName))</Raw>
        <Text class="mt-4 text-base text-muted">
          <Text as="span" class="font-semibold text-ink">{{ blade('$invitedByName') }}</Text> te invitó a formar parte del equipo de {{ blade('$accountName') }} en Wasiy. Acepta la invitación para crear tu acceso y empezar a trabajar en la plataforma.
        </Text>
        <Raw>@else</Raw>
        <Text class="mt-4 text-base text-muted">
          Te invitaron a formar parte del equipo de {{ blade('$accountName') }} en Wasiy. Acepta la invitación para crear tu acceso y empezar a trabajar en la plataforma.
        </Text>
        <Raw>@endif</Raw>

        <Spacer class="h-6" />

        <Section class="rounded-xl bg-cream px-6 py-5">
          <Row>
            <Column class="w-1/3"><Text class="m-0 text-sm text-muted">Rol</Text></Column>
            <Column class="w-2/3 text-right"><Text class="m-0 text-base font-semibold text-ink">{{ blade('$roleLabel') }}</Text></Column>
          </Row>
          <Raw>@if (!empty($locations))</Raw>
          <Row class="mt-3">
            <Column class="w-1/3"><Text class="m-0 text-sm text-muted">{{ blade("count($locations) === 1 ? 'Ubicación' : 'Ubicaciones'") }}</Text></Column>
            <Column class="w-2/3 text-right"><Text class="m-0 text-base font-semibold text-ink">{{ blade("implode(', ', $locations)") }}</Text></Column>
          </Row>
          <Raw>@endif</Raw>
        </Section>

        <Spacer class="h-8" />

        <Button
          :href="blade('$claimUrl')"
          class="rounded-xl bg-gold px-7 py-4 text-base font-semibold text-ink"
        >
          Aceptar invitación
        </Button>

        <Text class="mt-6 text-sm text-muted">
          El enlace vence el <Text as="span" class="font-semibold text-ink">{{ blade('$expiresOn') }}</Text>. Si vence, pide a quien te invitó que la envíe de nuevo.
        </Text>

        <Hr class="my-6 bg-border" />

        <Text class="m-0 text-[13px] text-faint">
          Si no esperabas esta invitación, puedes ignorar este correo. Nadie obtiene acceso sin abrir el enlace desde esta dirección.
        </Text>
      </Section>

      <WasiyFooter />
    </Container>
  </WasiyLayout>
</template>
