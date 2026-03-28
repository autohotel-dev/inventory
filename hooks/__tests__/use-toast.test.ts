import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useToast } from '../use-toast'
import { toast } from 'sonner'

// Mock the sonner toast module
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    loading: vi.fn(),
    promise: vi.fn(),
    dismiss: vi.fn(),
  },
}))

describe('useToast hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call toast.success with correct arguments', () => {
    const { result } = renderHook(() => useToast())

    result.current.success('Success message', 'Success description')

    expect(toast.success).toHaveBeenCalledWith('Success message', {
      description: 'Success description',
      duration: 4000,
    })
  })

  it('should call toast.success without description', () => {
    const { result } = renderHook(() => useToast())

    result.current.success('Success message')

    expect(toast.success).toHaveBeenCalledWith('Success message', {
      description: undefined,
      duration: 4000,
    })
  })

  it('should call toast.error with correct arguments', () => {
    const { result } = renderHook(() => useToast())

    result.current.error('Error message', 'Error description')

    expect(toast.error).toHaveBeenCalledWith('Error message', {
      description: 'Error description',
      duration: 6000,
    })
  })

  it('should call toast.info with correct arguments', () => {
    const { result } = renderHook(() => useToast())

    result.current.info('Info message', 'Info description')

    expect(toast.info).toHaveBeenCalledWith('Info message', {
      description: 'Info description',
      duration: 4000,
    })
  })

  it('should call toast.warning with correct arguments', () => {
    const { result } = renderHook(() => useToast())

    result.current.warning('Warning message', 'Warning description')

    expect(toast.warning).toHaveBeenCalledWith('Warning message', {
      description: 'Warning description',
      duration: 5000,
    })
  })

  it('should call toast.loading and return an id', () => {
    // Setup mock return for loading
    (toast.loading as any).mockReturnValue('toast-id')

    const { result } = renderHook(() => useToast())

    const id = result.current.loading('Loading message')

    expect(toast.loading).toHaveBeenCalledWith('Loading message')
    expect(id).toBe('toast-id')
  })

  it('should call toast.promise with correct arguments', () => {
    const { result } = renderHook(() => useToast())

    const mockPromise = Promise.resolve('data')
    const config = {
      loading: 'Loading...',
      success: 'Done!',
      error: 'Failed!',
    }

    result.current.promise(mockPromise, config)

    expect(toast.promise).toHaveBeenCalledWith(mockPromise, config)
  })

  it('should provide access to dismiss method', () => {
    const { result } = renderHook(() => useToast())

    result.current.dismiss('toast-id')

    expect(toast.dismiss).toHaveBeenCalledWith('toast-id')
  })
})
