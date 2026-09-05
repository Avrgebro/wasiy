<x-mail::message>
<span class="eyebrow">{{ $locationName }}</span>

# {{ $title }}

Hola {{ $recipientName }},

@if ($intro)
{{ $intro }}
@endif

@if ($facts !== [])
<x-mail::table>
| | |
|:--|--:|
@foreach ($facts as $fact)
| **{{ $fact['label'] }}** | {{ $fact['value'] }} |
@endforeach
</x-mail::table>
@endif

@if ($actionUrl && $actionLabel)
<x-mail::button :url="$actionUrl" color="primary">
{{ $actionLabel }}
</x-mail::button>
@endif

<span class="footnote">{{ $footnote ?? 'Puedes elegir qué avisos llegan a tu correo desde Perfil en el portal.' }}</span>
</x-mail::message>
