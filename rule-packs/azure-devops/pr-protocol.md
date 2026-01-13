# Pull Request Protocol

Create draft PR immediately:

```bash
az repos pr create --draft \
  --title "[WIP] #{id}: {description}" \
  --description "Resolves #{id}" \
  --work-items {id}
```

**Before marking ready:**
- All acceptance criteria checked
- Journey documented
- Commits squashed if noisy

**Completion Options:**
- Squash merge (recommended)
- Delete source branch
- Complete associated work items (auto-transition)
