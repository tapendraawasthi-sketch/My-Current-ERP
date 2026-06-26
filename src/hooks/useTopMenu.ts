import { useStore } from '../store/useStore';

export function useTopMenu() {
  const { activeTopMenu, setActiveTopMenu } = useStore();

  const openMenu = (menuId: string) => setActiveTopMenu(menuId);
  const closeMenu = () => setActiveTopMenu(null);
  const toggleMenu = (menuId: string) =>
    setActiveTopMenu(activeTopMenu === menuId ? null : menuId);

  return { activeTopMenu, openMenu, closeMenu, toggleMenu };
}
