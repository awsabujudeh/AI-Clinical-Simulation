# V2-017 Monitor Presentation Model

## Authority

The Clinical Monitor renders the committed `SafeSessionProjection.observations` returned by the secure Session boundary. Patient State, observation projection, Clinical Time, rhythm identity, and consciousness remain server/domain-owned. React neither calculates nor optimistically predicts clinical values.

The V2-017 monitor displays only the contracted heart rate, systolic/diastolic blood pressure, respiratory rate, SpO2, optional temperature, explicit rhythm, and consciousness descriptor. Units are presentation data and remain left-to-right inside Arabic layouts.

## Freshness

Current server projections are labelled authoritative. A recovered last-known projection is labelled as last confirmed, remains visibly frozen, and does not trigger private timeline or Assessment reads. No browser clock advances Clinical Time or observations.

## Rhythm and waveform

Clinical rhythm identity remains explicit. Known synthetic identifiers receive presentation-only Arabic and English labels; an unknown identifier receives a neutral case-configured label rather than exposing the raw code. V2-017 renders no ECG, diagnostic waveform, locally inferred morphology, medical severity colour, or vital threshold classification.

## Scope

Visual Patient remains a reserved integration slot. This task adds no media generation, diagnostic media, 3D dependency, Patient AI, or clinical transition logic.
