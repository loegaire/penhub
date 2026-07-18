const expected = "FLAG{cross_domain_verified}"
if (process.env.PENHUB_CANDIDATE !== expected) {
  console.error("candidate rejected")
  process.exit(1)
}

console.log("candidate accepted")
