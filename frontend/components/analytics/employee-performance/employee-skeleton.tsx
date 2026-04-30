export function EmployeeSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-muted/50"></div>
          <div>
            <div className="h-8 bg-muted/50 rounded w-48 mb-2"></div>
            <div className="h-4 bg-muted/50 rounded w-64"></div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-6 bg-muted/50 rounded w-20"></div>
          <div className="h-6 bg-muted/50 rounded w-24"></div>
        </div>
      </div>

      {/* Filtros Skeleton */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="h-12 bg-muted/50 rounded-xl"></div>
        </div>
        <div className="w-40 h-12 bg-muted/50 rounded-xl"></div>
        <div className="w-40 h-12 bg-muted/50 rounded-xl"></div>
      </div>

      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="relative overflow-hidden border-0 bg-gradient-to-br from-muted/30 to-transparent rounded-xl p-6">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 bg-muted/50 rounded w-3/4"></div>
              <div className="w-8 h-8 bg-muted/50 rounded-lg"></div>
            </div>
            <div className="h-8 bg-muted/50 rounded w-1/2"></div>
            <div className="h-4 bg-muted/50 rounded w-full mt-2"></div>
          </div>
        ))}
      </div>

      {/* Lista Empleados Skeleton */}
      <div className="border-0 bg-gradient-to-br from-muted/30 to-transparent rounded-xl">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-muted/50 rounded-lg"></div>
            <div>
              <div className="h-6 bg-muted/50 rounded w-32 mb-2"></div>
              <div className="h-4 bg-muted/50 rounded w-48"></div>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-background/50">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-muted/50 rounded-xl"></div>
                <div>
                  <div className="h-5 bg-muted/50 rounded w-32 mb-2"></div>
                  <div className="h-4 bg-muted/50 rounded w-24"></div>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="h-5 bg-muted/50 rounded w-8"></div>
                <div className="h-5 bg-muted/50 rounded w-16"></div>
                <div className="h-5 bg-muted/50 rounded w-12"></div>
                <div className="flex gap-1">
                  {[...Array(5)].map((_, j) => (
                    <div key={j} className="w-3 h-3 bg-muted/50 rounded-full"></div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
