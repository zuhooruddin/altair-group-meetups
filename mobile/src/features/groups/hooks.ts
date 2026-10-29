import { useQuery } from '@tanstack/react-query';
import { useServices } from '../../core/services';
import { queryKeys } from '../query-keys';

export function useMyGroups() {
  const { groups } = useServices();
  return useQuery({ queryKey: queryKeys.myGroups, queryFn: () => groups.listMine() });
}
