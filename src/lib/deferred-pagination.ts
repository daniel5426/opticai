export function deferPaginationTotal(
  loadCount: () => Promise<{ total: number | null }>,
  canCommit: () => boolean,
  setTotal: (total: number) => void,
) {
  window.setTimeout(() => {
    void loadCount()
      .then(({ total }) => {
        if (canCommit() && total !== null) setTotal(total)
      })
      .catch((error) => {
        console.error("Error loading pagination total:", error)
      })
  }, 0)
}
