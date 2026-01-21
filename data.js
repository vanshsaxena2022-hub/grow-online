module.exports = {
  shop: {
    id: "demo-shop",
    name: "Demo Decor Store",
    whatsapp: "919999999999",
    logo: "https://via.placeholder.com/120"
  },

  categories: [
    { id: "chair", name: "Chairs" },
    { id: "sofa", name: "Sofas" },
    { id: "lamp", name: "Lamps" }
  ],

  products: [
    {
      id: "chair1",
      category: "chair",
      name: "Wooden Chair",
      price: 3500,
      image: "https://via.placeholder.com/300"
    },
    {
      id: "sofa1",
      category: "sofa",
      name: "Luxury Sofa",
      price: 25000,
      image: "https://via.placeholder.com/300"
    },
    {
      id: "lamp1",
      category: "lamp",
      name: "Modern Lamp",
      price: 2200,
      image: "https://via.placeholder.com/300"
    }
  ]
};
