const mongoose = require("mongoose");

const quotationCatalogSchema = new mongoose.Schema(
  {
    key: { type: String, default: "default", unique: true },
    services: [
      {
        name: { type: String, required: true, trim: true },
        description: { type: String, trim: true, default: "" },
        price: { type: Number, min: 0, default: 0 },
        active: { type: Boolean, default: true },
        subServices: [
          {
            name: { type: String, required: true, trim: true },
            description: { type: String, trim: true, default: "" },
            price: { type: Number, min: 0, default: 0 },
            active: { type: Boolean, default: true },
          },
        ],
      },
    ],
    packages: [
      {
        name: { type: String, required: true, trim: true },
        description: { type: String, trim: true, default: "" },
        price: { type: Number, min: 0, required: true },
        active: { type: Boolean, default: true },
        selectedServices: [
          {
            serviceId: { type: String, required: true },
            subServiceId: { type: String, default: "" },
            serviceName: { type: String, required: true },
            subServiceName: { type: String, default: "" },
          },
        ],
      },
    ],
    durations: [
      {
        name: { type: String, required: true, trim: true },
        days: { type: Number, min: 0, default: 0 },
        custom: { type: Boolean, default: false },
        active: { type: Boolean, default: true },
      },
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model("QuotationCatalog", quotationCatalogSchema);
