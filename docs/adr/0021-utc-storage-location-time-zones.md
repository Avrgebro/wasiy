# UTC Storage With Location Time Zones

Wasiy will store timestamps in UTC while each Location defines an IANA time zone used for operational display and scheduling. Reservation and visitor workflows should interpret user-entered local dates and times in the Location's time zone, then persist UTC timestamps to avoid ambiguous scheduling and cross-location reporting issues.
