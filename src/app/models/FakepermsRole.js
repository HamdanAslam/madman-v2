import { Schema, model } from 'mongoose';

const fakepermsRoleSchema = new Schema({
  permissions: {
    type: Array,
    default: [],
  },
});

export default model('FakepermsRole', fakepermsRoleSchema);
