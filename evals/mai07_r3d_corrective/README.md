# MAI-07R3D corrective datasets (non-frozen)

- DEVELOPMENT: iterative implementation only
- HOLDOUT_VALIDATION: locked before runtime correction; open once after RC lock
- SAFETY_CHALLENGE: protected/English/name/Unicode probes

`prohibited_for_training=true` on every case.
Frozen V1/V2 case bodies and predictions were not used to construct gold labels.
