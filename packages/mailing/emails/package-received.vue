<template>
  <!--
    "Paquete recibido": recepción registered a parcel for a unit. Sent by
    App\Actions\Packages\RegisterPackage through ResidentAlertNotification
    with template 'package-received'. Blade data (same shape as example.vue):
    $locationName, $recipientName, $title, $intro?, $facts (Unidad,
    Recibido, Detalle?), $actionUrl?, $actionLabel?, $footnote?
  -->
  <WasiyLayout>
    <Preheader>{{ blade('$title') }} · {{ blade('$locationName') }}. Retíralo en recepción con tu documento.</Preheader>

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
          {{ blade('$locationName') }}
        </Text>

        <Heading class="font-sora text-[30px]/9 font-bold tracking-tight text-bg">
          {{ blade('$title') }}
        </Heading>
      </Section>

      <Section class="rounded-b-lg bg-white px-6 py-12 sm:rounded-none">
        <Text class="m-0 text-base text-ink">Hola {{ blade('$recipientName') }},</Text>

        <Raw>@if (!empty($intro))</Raw>
        <Text class="mt-4 text-base text-muted">{{ blade('$intro') }}</Text>
        <Raw>@endif</Raw>

        <Spacer class="h-6" />

        <!-- The parcel card: where it is and what recepción wrote down. -->
        <Section class="rounded-xl bg-cream px-6 py-6">
          <Text class="m-0 text-[12.5px] font-semibold uppercase tracking-[0.1em] text-teal-mid">
            En recepción
          </Text>

          <Raw>@foreach ($facts as $fact)</Raw>
          <!-- Short values sit on the label's row; a long one (the desk's
               notes) takes the full width under its label, otherwise it
               wraps into a ragged right-aligned block. -->
          <Raw>@if (mb_strlen($fact['value']) > 40)</Raw>
          <Text class="m-0 mt-3 text-sm text-muted">{{ blade("$fact['label']") }}</Text>
          <Text class="m-0 mt-1 text-base font-semibold text-ink">{{ blade("$fact['value']") }}</Text>
          <Raw>@else</Raw>
          <Row class="mt-3">
            <Column class="w-1/3">
              <Text class="m-0 text-sm text-muted">{{ blade("$fact['label']") }}</Text>
            </Column>
            <Column class="w-2/3 text-right">
              <Text class="m-0 text-base font-semibold text-ink">{{ blade("$fact['value']") }}</Text>
            </Column>
          </Row>
          <Raw>@endif</Raw>
          <Raw>@endforeach</Raw>
        </Section>

        <Text class="mt-6 text-sm text-muted">
          Para retirarlo, acércate a recepción con tu documento de identidad. Si lo recoge otra persona, recepción anotará quién lo recibió.
        </Text>

        <Raw>@if (!empty($actionUrl) && !empty($actionLabel))</Raw>
        <Spacer class="h-8" />

        <Button
          :href="blade('$actionUrl')"
          class="rounded-xl bg-gold px-7 py-4 text-base font-semibold text-ink"
        >
          {{ blade('$actionLabel') }}
        </Button>
        <Raw>@endif</Raw>

        <Raw>@if (!empty($footnote))</Raw>
        <Hr class="my-6 bg-border" />

        <Text class="m-0 text-[13px] text-faint">{{ blade('$footnote') }}</Text>
        <Raw>@endif</Raw>
      </Section>

      <WasiyFooter />
    </Container>
  </WasiyLayout>
</template>
