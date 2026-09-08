import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { router, usePathname } from "expo-router";

const CYAN = '#8FF3E8';
const CYAN_BORDER = '#B9F5EE';

const LINKS = [
  { label: 'Status', path: '../main/Status' },
  { label: 'Info', path: '../main/info' },
  { label: 'Goals', path: '../main/goals' },
  { label: 'Manage Tasks', path: '../main/manageTasks' },
];

/**
 * Shared replacement for the repeated <div id="nav-modal"> block in
 * goal.html / info.html / status.html. Renders in place (the calling
 * screen swaps this in for its normal content when open, same as the
 * old invisible/visible class toggle did).
 */
export default function NavMenu({ onNavigate }) {
  const pathname = usePathname();

  const go = (path) => {
    onNavigate?.();
    if (path !== pathname) router.push(path);
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.card}>
        {LINKS.map((link) => (
          <TouchableOpacity
            key={link.path}
            style={[styles.linkRow, pathname === link.path && styles.linkRowActive]}
            onPress={() => go(link.path)}
          >
            <Text style={[styles.linkText, pathname === link.path && styles.linkTextActive]}>
              {link.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, alignItems: 'center', paddingTop: 40, paddingHorizontal: 28 },
  card: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: CYAN_BORDER,
    backgroundColor: 'rgba(8, 20, 28, 0.95)',
    paddingVertical: 12,
    shadowColor: CYAN,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  linkRow: {
    paddingVertical: 16,
    paddingHorizontal: 22,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  linkRowActive: { backgroundColor: 'rgba(143,243,232,0.08)' },
  linkText: { color: '#F2F5F5', fontSize: 17, fontWeight: '600' },
  linkTextActive: { color: CYAN, fontWeight: '800' },
});