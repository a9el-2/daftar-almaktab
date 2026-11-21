export function generateSecurePassword(length = 12): string {
  const lowers = "abcdefghjkmnpqrstuvwxyz";
  const uppers = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const specials = "!@#$%&*";
  const allChars = lowers + uppers + digits + specials;

  let pwd = "";
  pwd += lowers[Math.floor(Math.random() * lowers.length)];
  pwd += uppers[Math.floor(Math.random() * uppers.length)];
  pwd += digits[Math.floor(Math.random() * digits.length)];
  pwd += specials[Math.floor(Math.random() * specials.length)];

  for (let i = 4; i < length; i++) {
    pwd += allChars[Math.floor(Math.random() * allChars.length)];
  }

  return pwd
    .split("")
    .sort(() => 0.5 - Math.random())
    .join("");
}
