/** Constants for Cloud Resource environment. */
export declare const CLOUD_RESOURCE: {
    /** The type of the Resource. */
    TYPE: string;
    /**
     * Key for the name of the cloud provider. Example values are aws, azure,
     * gcp.
     */
    PROVIDER_KEY: string;
    /** The value of the provider when running in AWS. */
    PROVIDER_AWS: string;
    /** The value of the provider when running in AZURE. */
    PROVIDER_AZURE: string;
    /** The value of the provider when running in GCP. */
    PROVIDER_GCP: string;
    /** Key for the region in which entities are running. */
    REGION_KEY: string;
    /** Key for the cloud account id used to identify different entities. */
    ACCOUNT_ID_KEY: string;
    /** Key for the zone in which entities are running. */
    ZONE_KEY: string;
};
/** Constants for K8S container Resource. */
export declare const CONTAINER_RESOURCE: {
    /** Kubernetes resources key that represents a type of the resource. */
    TYPE: string;
    /** Key for the container name. */
    NAME_KEY: string;
    /** Key for the container image name. */
    IMAGE_NAME_KEY: string;
    /** Key for the container image tag. */
    IMAGE_TAG_KEY: string;
};
/**
 * Constants for Host Resource. A host is defined as a general computing
 * instance.
 */
export declare const HOST_RESOURCE: {
    /** The type of the Resource. */
    TYPE: string;
    /**
     * Key for the hostname of the host.
     * It contains what the `hostname` command returns on the host machine.
     */
    HOSTNAME_KEY: string;
    /**
     * Key for the name of the host.
     * It may contain what `hostname` returns on Unix systems, the fully
     * qualified, or a name specified by the user.
     */
    NAME_KEY: string;
    /** Key for the unique host id (instance id in Cloud). */
    ID_KEY: string;
    /** Key for the type of the host (machine type). */
    TYPE_KEY: string;
};
/** Constants for Kubernetes deployment service Resource. */
export declare const K8S_RESOURCE: {
    /** The type of the Resource. */
    TYPE: string;
    /** Key for the name of the cluster. */
    CLUSTER_NAME_KEY: string;
    /** Key for the name of the namespace. */
    NAMESPACE_NAME_KEY: string;
    /** Key for the name of the pod. */
    POD_NAME_KEY: string;
};
