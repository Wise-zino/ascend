import { Text, View, StyleSheet, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";

export default function App() {
  return (
    <LinearGradient
      colors={["#090013", "#080327"]}
      start={{x: 0, y: 0}}
      end={{x: 0, y: 1}}
      style={styles.container}
    >
      <View style={{ alignItems: "center" }}>
        <Text style={styles.mainText}>ASCEND</Text>
        <Text style={styles.descriptiveText}>[Adaptive System for Continous Evolution and Neural Development]</Text>
        <Pressable
          style={styles.button}
          onPress={() => router.push("/playerNotification")}
        >
          <Text style={styles.buttonText}>Get Started</Text>
        </Pressable>
      </View>
    </LinearGradient>
    
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, // enables the View using it to fill the screen
    alignItems: "center",
    justifyContent: "center",
  },
  mainText: {
    fontSize: 40,
    fontWeight: "bold",
    color: "#f3ecec",
    textAlign: "center",
    marginVertical: 5,
  },
  descriptiveText: {
    fontSize: 15,
    fontStyle: "italic",
    fontWeight: "300",
    color: "#6e6a6a",
    textAlign: "center",
    marginVertical: 5,
  },
  button: {
    backgroundColor: "#faf1f1",
    padding: 15,
    borderRadius: 20,
    alignItems: "center",
    width: "65%",
    marginTop: 150,
    opacity: 0.88
  },
  buttonText: {
    color: "#000",
    fontWeight: "600",
    fontSize: 25
  }
});
