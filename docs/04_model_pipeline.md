# 3D Asset Pipeline & Validation

## Coordinate System
- Y-up
- Right-handed
- Unit: meters

## Output Requirements (GLB)
- glTF 2.0 compliant
- Embedded or external textures allowed
- Triangle count < 500k (MVP soft limit)

## Validation Steps
1. glTF validator
2. File existence check
3. Mesh & material count threshold
4. Texture resolution <= 4K

## Failure Handling
- Any validation failure marks job as FAILED
- User receives readable error message
